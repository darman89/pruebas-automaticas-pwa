(function () {
    'use strict';

    var t1, t2;
    var app = {
        isLoading: true,
        visibleCards: {},
        selectedTimetables: [],
        spinner: document.querySelector('.loader'),
        cardTemplate: document.querySelector('.cardTemplate'),
        container: document.querySelector('.main'),
        addDialog: document.querySelector('.dialog-container')
    };

    if (!('indexedDB' in window)) {
        console.log('This browser doesn\'t support IndexedDB');
        return;
      }
    
      const dbPromise = window.idb.openDb('station-store', 1, upgradeDB => {
        upgradeDB.createObjectStore('station');
      });
      
      const idbKeyval = {
        async get(key) {
          const db = await dbPromise;
          return db.transaction('station').objectStore('station').get(key);
        },
        async set(key, val) {
          const db = await dbPromise;
          const tx = db.transaction('station', 'readwrite');
          tx.objectStore('station').put(val, key);
          return tx.complete;
        },
        async delete(key) {
          const db = await dbPromise;
          const tx = db.transaction('station', 'readwrite');
          tx.objectStore('station').delete(key);
          return tx.complete;
        },
        async clear() {
          const db = await dbPromise;
          const tx = db.transaction('station', 'readwrite');
          tx.objectStore('station').clear();
          return tx.complete;
        },
        async keys() {
          const db = await dbPromise;
          return db.transaction('station').objectStore('station').getAllKeys(key);
        },
      };

      idbKeyval.set('metros/1/bastille/A', {label: 'world'});
      idbKeyval.get('metros/1/bastille/A').then(val => console.log(val));


    /*****************************************************************************
     *
     * Event listeners for UI elements
     *
     ****************************************************************************/

    document.getElementById('butRefresh').addEventListener('click', function () {
        // Refresh all of the metro stations
        app.updateSchedules();
    });

    document.getElementById('butAdd').addEventListener('click', function () {
        // Open/show the add new station dialog
        app.toggleAddDialog(true);
    });

    document.getElementById('butAddCity').addEventListener('click', function () {


        var select = document.getElementById('selectTimetableToAdd');
        var selected = select.options[select.selectedIndex];
        var key = selected.value;
        var label = selected.textContent;
        if (!app.selectedTimetables) {
            app.selectedTimetables = [];
        }
        app.getSchedule(key, label);
        app.selectedTimetables.push({
            key: key,
            label: label
        });
        app.saveSelectedStations();
        app.toggleAddDialog(false);
    });

    document.getElementById('butAddCancel').addEventListener('click', function () {
        // Close the add new station dialog
        app.toggleAddDialog(false);
    });


    /*****************************************************************************
     *
     * Methods to update/refresh the UI
     *
     ****************************************************************************/

    // Toggles the visibility of the add new station dialog.
    app.toggleAddDialog = function (visible) {
        if (visible) {
            app.addDialog.classList.add('dialog-container--visible');
        } else {
            app.addDialog.classList.remove('dialog-container--visible');
        }
    };

    // Updates a timestation card with the latest weather forecast. If the card
    // doesn't already exist, it's cloned from the template.

    app.updateTimetableCard = function (data) {
        var key = data.key;
        var dataLastUpdated = new Date(data.created);
        var schedules = data.schedules;
        var card = app.visibleCards[key];

        if (!card) {
            var label = data.label.split(', ');
            var title = label[0];
            var subtitle = label[1];
            card = app.cardTemplate.cloneNode(true);
            card.classList.remove('cardTemplate');
            card.querySelector('.label').textContent = title;
            card.querySelector('.subtitle').textContent = subtitle;
            card.removeAttribute('hidden');
            app.container.appendChild(card);
            app.visibleCards[key] = card;
        }
        card.querySelector('.card-last-updated').textContent = data.created;

        var scheduleUIs = card.querySelectorAll('.schedule');
        for (var i = 0; i < 4; i++) {
            var schedule = schedules[i];
            var scheduleUI = scheduleUIs[i];
            if (schedule && scheduleUI) {
                scheduleUI.querySelector('.message').textContent = schedule.message;
            }
        }

        if (app.isLoading) {

            app.spinner.setAttribute('hidden', true);
            app.container.removeAttribute('hidden');
            app.isLoading = false;
        }
    };

    /*****************************************************************************
     *
     * Methods for dealing with the model
     *
     ****************************************************************************/


    app.getSchedule = function (key, label) {
        var url = 'https://api-ratp.pierre-grimaud.fr/v3/schedules/' + key;

        if ('caches' in window) {
            /*
             * Check if the service worker has already cached this city's weather
             * data. If the service worker has the data, then display the cached
             * data while the app fetches the latest data.
             */
            caches.match(url).then(function(response) {
              if (response) {
                response.json().then(function updateFromCache(json) {
                  var results = json.result;
                  results.key = key;
                  results.label = label;
                  app.updateTimetableCard(results);
                });
              }
            });
          }
      

        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    t2=performance.now();
                    window.cardLoadTime = t2 - t1;
                    var response = JSON.parse(request.response);
                    var result = {};
                    result.key = key;
                    result.label = label;
                    result.created = response._metadata.date;
                    result.schedules = response.result.schedules;
                    app.updateTimetableCard(result);
                }
            } else {
                // Return the initial weather forecast since no data is available.
                app.updateTimetableCard(initialStationTimetable);
            }
        };
        request.open('GET', url);
        t1=performance.now();
        request.send();
        
    };

    // Iterate all of the cards and attempt to get the latest timetable data
    app.updateSchedules = function () {
        var keys = Object.keys(app.visibleCards);
        keys.forEach(function (key) {
            app.getSchedule(key);
        });
    };

    // Save list of Stations to localStorage.
    app.saveSelectedStations = function () {
        var selectedTimetables = JSON.stringify(app.selectedTimetables);
        app.selectedTimetables.forEach(function (city) {
            idbKeyval.set(city.key, {key: city.key, label: city.label});
        });
        localStorage.selectedTimetables = selectedTimetables;
    };



    /*
     * Fake timetable data that is presented when the user first uses the app,
     * or when the user has not saved any stations. See startup code for more
     * discussion.
     */

    var initialStationTimetable = {

        key: 'metros/1/bastille/A',
        label: 'Bastille, Direction La Défense',
        created: '2017-07-18T17:08:42+02:00',
        schedules: [{
                message: '0 mn'
            },
            {
                message: '2 mn'
            },
            {
                message: '5 mn'
            }
        ]


    };


    /************************************************************************
     *
     * Code required to start the app
     *
     * NOTE: To simplify this codelab, we've used localStorage.
     *   localStorage is a synchronous API and has serious performance
     *   implications. It should not be used in production applications!
     *   Instead, check out IDB (https://www.npmjs.com/package/idb) or
     *   SimpleDB (https://gist.github.com/inexorabletash/c8069c042b734519680c)
     ************************************************************************/

    app.getSchedule('metros/1/bastille/A', 'Bastille, Direction La Défense');
        
    app.selectedTimetables = localStorage.selectedTimetables;
       

    if (app.selectedTimetables) {

        dbPromise.then(db => {
            return db.transaction('station')
              .objectStore('station').getAll();
          }).then(allObjs => app.selectedTimetables = allObjs);

        app.selectedTimetables = JSON.parse(app.selectedTimetables);
        app.selectedTimetables.forEach(function (city) {
            app.getSchedule(city.key, city.label);
        });
    } else {
        app.updateTimetableCard(initialStationTimetable);
        app.selectedTimetables = [{
            key: initialStationTimetable.key,
            label: initialStationTimetable.label
        }];
        idbKeyval.set(initialStationTimetable.key, {key: initialStationTimetable.key, label: initialStationTimetable.label});
        app.saveSelectedStations();
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
                 .register('./service-worker.js')
                 .then(function() { console.log('Service Worker Registered'); });
      }

      
    
    

})();
