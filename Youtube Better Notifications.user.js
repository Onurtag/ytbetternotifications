// ==UserScript==
// @name            YtBetterNotifications (Alpha)
// @namespace       Yt.Better.Notifications
// @version         1.1.4
// @description     A new youtube desktop notifications panel with extra functionality.
// @author          Onurtag
// @match           https://www.youtube.com/new*
// @grant           none
// @require         https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment-with-locales.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/dexie/3.0.2/dexie.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/downloadjs/1.4.8/download.min.js
// @require         https://cdn.jsdelivr.net/npm/dexie-export-import@1.0.0-rc.2/dist/dexie-export-import.min.js
// @require         https://cdn.jsdelivr.net/npm/js-base64@3.6.0/base64.min.js
// @run-at          document-idle
// ==/UserScript==

let db,
    selectedfile,
    currentPage = 0,
    shouldSendEmail = false,
    emailGAPIReady = false,
    GAPIClientID = null,
    GAPIClientKey = null,
    useEmailSecureToken = false,
    maxPages = 99999;

ytbnDebugEmail = false;
console.log("ytbnDebugEmail", ytbnDebugEmail);

let dontSendEmailsOver = 100;
let itemsperPage = 50;
let liveTitlePrependString = "🔴 ";

const regexVideoURLtoID = /(.*?(watch.v=|watch_videos.video_ids=)(.*?)($|,.*$))/;
const regexImageURLtoID = /https?:\/\/i.ytimg.com\/(vi|vi_webp)\/(.*?)\/.*?.(jpg|webp)/;


//Play an silent audio file to prevent throttling (different files for firefox/chromium)
//Might require autoplay to be turned on for the website
var silentAudio, silentAudioFile;
var isFirefox = typeof InstallTrigger !== 'undefined';
if (isFirefox == true) {
    silentAudioFile = 'data:audio/ogg;base64,T2dnUwACAAAAAAAAAAAHA8coAAAAAIF47n4BE09wdXNIZWFkAQE0AEAfAAAAAABPZ2dTAAAAAAAAAAAAAAcDxygBAAAAUzJlNAGOT3B1c1RhZ3MNAAAATGF2ZjU1LjMzLjEwMAQAAAAVAAAAYXV0aG9yPUFkdmVudHVyZSBMYW5kFAAAAGFsYnVtPUFkdmVudHVyZSBMYW5kIwAAAHRpdGxlPUVtcHR5IExvb3AgRm9yIEpTIFBlcmZvcm1hbmNlFQAAAGVuY29kZXI9TGF2ZjU1LjMzLjEwME9nZ1MAAFi9AAAAAAAABwPHKAIAAAAyAzleMwoNCgsPCQkMDgwKDA0ODQ0NDAwMDAwMCw4MDQ4LDA0ODAwNDQwLCwoPDgwLCg0MDgsMDAgDQvtgoSdsKEAINjpmG6kyq3UB2fEgCDZ/rdQl7AWg4Ag2dYShfx2/4UHACDZ/ow5omm9mOzA0aJyXCDZ1OLVrIJjzCAVr7b2iKamgCDZ1SDnykImIDYOACDa3TfB0Gr+bWrtGb+AINnUv+ROFBR8zDoAINnVnnsPAbLa6CDZ6sGCGuOv3nlNwCDZ6I3ut9dAaHCqX3wg2XDBwFzhT1bJXG4SgCDZ1SFKCeQWBogMPggg2daDavCMN1fLmYOAINmjtoTkep+3zvsjPCDa5WDHLsGmySt1gCDZ6KI6PqMV1GKI4CDZ2BdGcG3TAu1uACDa9TAnYduSD+H3wCDZ1bhTJjA3kXrTACDU4w/g6h585SxZ0CDZ1oxPBDPDre7gINnVBqj1sCfuTiZIzsAg2dgRZAKiazM0ItQg2dgXiRKSpPCjR/SgINnXJOQWzDETgs/tm4Ag2O4gbz8WYlj2wCDWdjVsms44oglYaCDZ1S85AzQVEE/b83Ag2eW35JDbXlk8eCJfMCDcki/+9RVLZ3O4fCDVey7IEoi5wDZcVCDZ0LF6mtpuWlXG8YAg2V2QIXTjvaCEIOIwINnWjFnyIy+83bLgINnXL0yMgbqjfyAg2uVeivlfw1LfQCDZ1y8XIVqvYVQg2daJgNh1l6Ul2oTOYaAg2doUKwX0fVXOgLHrQCDZ1pGelDVg0sabgCDZC/Z1+dxdRPIwINnQw8kKLxYt5CDZ2BBYNLi6nUoeI4Ag2V5BoAlPMrQ57YAg2dW1ns/tgS0qGpA1ACDZX214nEzghqKQINacJO/rHa02gVEYINleU2/9UWr02NuBPZ2dTAAQwwwAAAAAAAAcDxygDAAAARL86cAEKCAVTo0DgY4cToA==';
    silentAudio = new Audio(silentAudioFile);
    silentAudio.volume = 0.01;
} else {
    silentAudioFile = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjcxLjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAEAAABVgANTU1NTU1Q0NDQ0NDUFBQUFBQXl5eXl5ea2tra2tra3l5eXl5eYaGhoaGhpSUlJSUlKGhoaGhoaGvr6+vr6+8vLy8vLzKysrKysrX19fX19fX5eXl5eXl8vLy8vLy////////AAAAAExhdmM1Ny44OQAAAAAAAAAAAAAAACQCgAAAAAAAAAVY82AhbwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAALACwAAP/AADwQKVE9YWDGPkQWpT66yk4+zIiYPoTUaT3tnU487uNhOvEmQDaCm1Yz1c6DPjbs6zdZVBk0pdGpMzxF/+MYxA8L0DU0AP+0ANkwmYaAMkOKDDjmYoMtwNMyDxMzDHE/MEsLow9AtDnBlQgDhTx+Eye0GgMHoCyDC8gUswJcMVMABBGj/+MYxBoK4DVpQP8iAtVmDk7LPgi8wvDzI4/MWAwK1T7rxOQwtsItMMQBazAowc4wZMC5MF4AeQAGDpruNuMEzyfjLBJhACU+/+MYxCkJ4DVcAP8MAO9J9THVg6oxRMGNMIqCCTAEwzwwBkINOPAs/iwjgBnMepYyId0PhWo+80PXMVsBFzD/AiwwfcKGMEJB/+MYxDwKKDVkAP8eAF8wMwIxMlpU/OaDPLpNKkEw4dRoBh6qP2FC8jCJQFcweQIPMHOBtTBoAVcwOoCNMYDI0u0Dd8ANTIsy/+MYxE4KUDVsAP8eAFBVpgVVPjdGeTEWQr0wdcDtMCeBgDBkgRgwFYB7Pv/zqx0yQQMCCgKNgonHKj6RRVkxM0GwML0AhDAN/+MYxF8KCDVwAP8MAIHZMDDA3DArAQo3K+TF5WOBDQw0lgcKQUJxhT5sxRcwQQI+EIPWMA7AVBoTABgTgzfBN+ajn3c0lZMe/+MYxHEJyDV0AP7MAA4eEwsqP/PDmzC/gNcwXUGaMBVBIwMEsmB6gaxhVuGkpoqMZMQjooTBwM0+S8FTMC0BcjBTgPwwOQDm/+MYxIQKKDV4AP8WADAzAKQwI4CGPhWOEwCFAiBAYQnQMT+uwXUeGzjBWQVkwTcENMBzA2zAGgFEJfSPkPSZzPXgqFy2h0xB/+MYxJYJCDV8AP7WAE0+7kK7MQrATDAvQRIwOADKMBuA9TAYQNM3AiOSPjGxowgHMKFGcBNMQU1FMy45OS41VVU/31eYM4sK/+MYxKwJaDV8AP7SAI4y1Yq0MmOIADGwBZwwlgIJMztCM0qU5TQPG/MSkn8yEROzCdAxECVMQU1FMy45OS41VTe7Ohk+Pqcx/+MYxMEJMDWAAP6MADVLDFUx+4J6Mq7NsjN2zXo8V5fjVJCXNOhwM0vTCDAxFpMYYQU+RlVMQU1FMy45OS41VVVVVVVVVVVV/+MYxNcJADWAAP7EAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxOsJwDWEAP7SAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxPMLoDV8AP+eAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxPQL0DVcAP+0AFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    silentAudio = new Audio(silentAudioFile);
}
silentAudio.loop = true;
silentAudio.play();


function startup() {
    let startInterval = setInterval(() => {
        //wait for the notification button to appear (first load)
        if (document.querySelector("div#button.ytd-notification-topbar-button-renderer") == null) {
            return;
        }
        clearInterval(startInterval);

        //set moment.js locale
        moment.locale(document.querySelector("html").lang);

        setupDB().then(result => {

            //read settings
            return readSettings();

        }).then(result => {

            //Setup the notifications div (and it starts spinning)
            addStyles();
            setupNotificationDiv();

            //Enable the smaller notifications panel css which loads notifications faster
            document.querySelector("#smallernotpanel").disabled = false;
            //Open notifications panel for scrolling
            document.querySelector("div#button.ytd-notification-topbar-button-renderer").click();

            let waiting = 0;
            let startInterval2 = setInterval(() => {
                //Wait for the GAPI if we are using it.
                if (GAPIClientID == null || emailGAPIReady == true || waiting > 10000) {
                    
                    //Wait for any notification element to appear
                    if (document.querySelector('ytd-notification-renderer') != null) {
                        clearInterval(startInterval2);

                        //start scrolling through notifications
                        scrollNotifications();

                    }
                }
                waiting += 100;
            }, 100);
            return;

        });
    }, 100);
}

function scrollNotifications(scrolltimes = 1, interval = 250) {

    //Play silent audio
    silentAudio.play();

    let scrollcount = 0,
        skipfirst = 0,
        nullcount = 0,
        scrollingto = 0;
    let maxnullcount = 9;
    let scrollforwards = true;

    let scrollInterval = setInterval(() => {
        if (skipfirst) {
            skipfirst--;
            return;
        }
        if ((scrollcount <= scrolltimes) && (scrollforwards == 1)) {
            try {
                scrollingto += 5;
                //document.querySelector('[menu-style="multi-page-menu-style-type-notifications"] ytd-continuation-item-renderer').scrollIntoView();
                let scrollinghere = document.querySelectorAll("ytd-notification-renderer")[scrollingto];
                if (scrollinghere == null) {
                    if (nullcount >= maxnullcount) {
                        //its the last page of the notifications panel (max 4 weeks)
                        //clearInterval(scrollInterval);
                        scrollforwards = false;
                        return;
                    }
                    nullcount++;
                    scrollingto -= 5;
                } else {
                    scrollinghere.scrollIntoView();
                }
                scrollcount++;
                let length = document.querySelectorAll("ytd-notification-renderer").length;
                if (scrollcount != length / 20) {
                    scrollcount = length / 20;
                }
            } catch (error) {
                console.log("scrolling error:", error);
            }
        } else {
            //scrolling back up to load the missing images
            if (scrollforwards == true) {
                scrollforwards = false;
            }
            if ((scrollforwards == false) && (scrollingto >= 5)) {
                scrollingto -= 5;
                //document.querySelector('[menu-style="multi-page-menu-style-type-notifications"] ytd-continuation-item-renderer').scrollIntoView();
                let scrollinghere = document.querySelectorAll("ytd-notification-renderer")[scrollingto];
                scrollinghere.scrollIntoView();
                return;
            }

            //---Scrolling is finished---
            //---Scrolling is finished---
            //---Scrolling is finished---
            clearInterval(scrollInterval);
            //Continue the rest of the loading process
            continuing();
        }
    }, interval);
}

function continuing() {

    //Async update the notifications database
    saveNotifications().then(result => {

        //Close notifications panel
        document.querySelector("div#button.ytd-notification-topbar-button-renderer").click();
        //Disable smaller notifications panel 
        document.querySelector("#smallernotpanel").disabled = true;
        return;

    }).then(result => {

        //load notifications database into the table
        return loadNotifications();

    }).then(result => {

        //disable spinner
        showSpinner(false);

        return setupPaginationButtons();

    }).then(result => {

        //pause silent audio
        silentAudio.pause();

    });

}

//create random ids (without extra libraries)
function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

//create SHA-256 hashes from strings for duplicate checks
async function digestToSHA256(message) {
    const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}

async function exportDB(event) {
    try {
        const blob = await db.export({
            prettyJson: true,
            progressCallback
        });
        download(blob, "ytbetternotifications-export.json", "application/json");
    } catch (error) {
        console.error('File export error: ' + error);
    }
}

function fileInputOnchange(event) {
    selectedfile = event.target.files[0];
    // console.log("Selected file: " + selectedfile.name);
}

async function importDB(event) {
    var r = confirm("Are you sure? This will delete all your current data.");
    if (r != true) {
        return;
    }
    let file = selectedfile;
    try {
        if (!file) {
            throw new Error(`Only files can be input here.`);
        }

        console.log("Importing file: " + file.name);
        cleanTable();
        showSpinner();
        document.querySelector("#notificationOptions").remove();

        await db.delete();
        db = await Dexie.import(file, {
            progressCallback
        });

        await loadNotifications(0);
        currentPage = 0;
        setupPaginationButtons();
        showSpinner(false);
        console.log("Import complete.");
        return;
    } catch (error) {
        console.error('File import error: ' + error);
    }
}

function progressCallback({
    totalRows,
    completedRows
}) {
    console.log(`Export/Import Progress: ${completedRows} of ${totalRows} rows completed.`);
}

async function setupDB() {
    db = new Dexie("NotificationsDatabase");

    //COULD delete the &id and use hash for its functionality instead. This could allow importing new notifs without clearing db
    //      but you can just export -> combine -> import and that stuff is rare anyways.

    await db.version(2).stores({
        notifications: '++number, &id, hash, url, title, time, userimgurl, videoimgurl, channelname, duration, read, live, notvideo, extras',
        settings: 'key, value, extra',
        logs: '++number, type, time, extra, log',
    });

    // db.version(2).stores({
    //
    //
    // }).upgrade(trans => {
    //     /*
    //     var YEAR = 365 * 24 * 60 * 60 * 1000;
    //     return trans.friends.toCollection().modify (friend => {
    //         friend.birthdate = new Date(Date.now() - (friend.age * YEAR));
    //         delete friend.age;
    //     });
    //     */
    // });

    await db.open().catch(function(err) {
        console.error(err.stack || err);
    });

    //db.delete();
}

function previousPage(event) {
    if (currentPage == 0) {
        return;
    }
    cleanTable();
    loadNotifications(currentPage - 1).then(function(result) {
        --currentPage;
        setupPaginationButtons();
        return result;
    });
}

function nextPage(event) {
    if (currentPage == maxPages - 1) {
        return;
    }
    cleanTable();
    loadNotifications(currentPage + 1).then(function(result) {
        ++currentPage;
        setupPaginationButtons();
        return result;
    });

}

function firstPage(event) {
    if (currentPage == 0) {
        return;
    }
    cleanTable();
    loadNotifications(0).then(function(result) {
        currentPage = 0;
        setupPaginationButtons();
        return result;
    });
}

function lastPage(event) {
    if (currentPage == maxPages - 1) {
        return;
    }
    cleanTable();
    loadNotifications(maxPages - 1).then(function(result) {
        currentPage = maxPages - 1;
        setupPaginationButtons();
        return result;
    });
}

function discardNotifications(event) {
    var r = confirm("Are you sure?");
    if (r != true) {
        return;
    }
    cleanTable();
    db.notifications.clear();
    //setupdb is not needed
    setupDB();
}

function discardSettings(event) {
    var r = confirm("Are you sure?");
    if (r != true) {
        return;
    }
    //cleanTable();
    db.settings.clear();
    //setupdb is not needed
    setupDB();
    //"close" settings menu
    document.querySelector("#notificationOptions").remove();
}

function showSpinner(showit = true) {
    if (showit) {
        //Enable spinner
        document.querySelector("#outerNotifications paper-spinner").setAttribute("active", "");
        document.querySelector("#loadindicator").hidden = false;
    } else {
        //Disable the spinner
        document.querySelector("#outerNotifications paper-spinner").removeAttribute("active");
        document.querySelector("#loadindicator").hidden = true;
    }
}

function loadAll(event) {
    //"close" settings menu
    document.querySelector("#notificationOptions").remove();

    cleanTable();
    showSpinner();
    //Enable the smaller notifications panel which loads notifications faster
    document.querySelector("#smallernotpanel").disabled = false;
    document.querySelector("div#button.ytd-notification-topbar-button-renderer").click();
    scrollNotifications(6666, 300);
}

function livetransparency(event) {
    document.querySelector("#livetransparencycss").disabled = !document.querySelector("#livetransparencycss").disabled;
}

function readtransparency(event) {
    document.querySelector("#readtransparencycss").disabled = !document.querySelector("#readtransparencycss").disabled;
}

function commenttransparency(event) {
    document.querySelector("#commenttransparencycss").disabled = !document.querySelector("#commenttransparencycss").disabled;
}

function hideLive(event) {
    document.querySelector("#hidelivecss").disabled = !document.querySelector("#hidelivecss").disabled;
}

function hideRead(event) {
    document.querySelector("#hidereadcss").disabled = !document.querySelector("#hidereadcss").disabled;
}

function hideReplies(event) {
    document.querySelector("#hiderepliescss").disabled = !document.querySelector("#hiderepliescss").disabled;
}

function cleanTable() {
    document.querySelector("#innerNotifications").innerHTML = "";
}

async function saveNotifications() {

    let nodeArray = Array.from(document.querySelectorAll("ytd-notification-renderer"));

    let newCount = 0;
    let emailDictArray = [];
    let promiseResults = await Promise.all(nodeArray.map(async (element) => {

        let notVideo = false;
        let rowUrl = element.firstElementChild.href;

        //if the notification thumbnail images aren't there, skip.
        let userImg = element.querySelectorAll("img")[0].src;
        if (!userImg) {
            return "userimagedidnotload";
        }

        let videoImage = element.querySelectorAll("img")[1].src;
        if (!videoImage) {
            return "videoimagedidnotload";
        }

        if (rowUrl == "") {
            //if the notification is not a video link, mark as notvideo (comment)
            //and instead parse the video url from the videoimgurl
            notVideo = true;
            let matchingID = videoImage.match(regexImageURLtoID)[2];
            rowUrl = 'https://www.youtube.com/watch?v=' + matchingID;
        }

        let currDict = {
            id: uuidv4(),
            hash: "",
            url: rowUrl,
            title: element.querySelectorAll("yt-formatted-string")[0].innerText,
            time: reversefromNow(element.querySelectorAll("yt-formatted-string")[2].innerText),
            userimgurl: userImg,
            videoimgurl: videoImage,
            live: false,
            read: false,
            notvideo: notVideo,
        };

        // detect duplications
        //hash the combination of url+title(comment)+userimgurl
        currDict.hash = await digestToSHA256(currDict.url + currDict.userimgurl + currDict.title);

        //duplicate check using hash
        const count = await db.notifications
            .where('hash')
            .equals(currDict.hash)
            .count().then(function(count) {
                return count;
            });
        //the notification already exists so skip it.
        if (count > 0) {
            return "alreadyexists";
        }

        console.log("saveNotifications -> currDict", currDict);

        //detect livestreams
        if (currDict.title.indexOf(" is live: ") != -1) {
            currDict.live = true;
            //set livestreams as read automatically
            currDict.read = true;
        }

        //put the notification into the database
        const dbput = await db.notifications.put(currDict);

        if (shouldSendEmail) {
            //We are done here, but; currDict gets modified so duplicate it.
            emailDictArray.push(JSON.parse(JSON.stringify(currDict)));
        }

        newCount++;

        return dbput;
    }));

    //get db size and set max pages
    const itemcount = await db.notifications
        .count().then(function(count) {
            return count;
        });
    maxPages = Math.ceil(itemcount / itemsperPage);

    console.log(newCount + " new notifications were saved into the db.");

    //send all emails
    if (shouldSendEmail || emailDictArray.length > 0) {
        sendEmailBatch(emailDictArray);
    }
}

async function loadNotifications(page = 0) {
    const notificationsArray = await db.notifications.orderBy('time').reverse().offset(page * itemsperPage).limit(itemsperPage).toArray().then(function(result) {
        return result;
    });

    notificationsArray.forEach(dict => {
        displayNotification(dict);
    });
}

function displayNotification(currDict) {

    //display notifications also send the dictionary to save as well.

    const dummyHTML = `
    <div data-id="DUMMYDATASETID" class="notificationsRow">
        <div class="notifRowItem notcol1">
            ROWDUMMYROW1
        </div>
        <div class="notifRowItem notcol2">
            ROWDUMMYROW2
        </div>
        <div class="notifRowItem notcol3">
            ROWDUMMYROW3
        </div>
        <div class="notifRowItem notcol4">
            ROWDUMMYROW4
        </div>
        <div class="notifRowItem notcol5">
            <paper-checkbox noink READCHECKED>Read</paper-checkbox>
        </div>
    </div>
    `;

    let elemDiv = document.createElement("div");
    let elemHTML = dummyHTML;
    //columns: usericon, url+title, time, videothumb, read
    let col1, col2, col3, col4, col5;

    //usericon
    col1 = '<img src="' + currDict.userimgurl + '"></img>';

    //time
    col3 = moment(currDict.time).fromNow();

    //title
    if (currDict.live) {
        //handle live & live title prepend
        elemHTML = elemHTML.replace('notificationsRow', 'notificationsRow notificationLive');
        col2 = '<a target="_blank" href="' + currDict.url + '">' + liveTitlePrependString + currDict.title + '</a>';
    } else {
        col2 = '<a target="_blank" href="' + currDict.url + '">' + currDict.title + '</a>';
    }

    //Handle comments
    if (currDict.notvideo) {
        elemHTML = elemHTML.replace('notificationsRow', 'notificationsRow notificationComment');
        //currDict.url = "javascript:void(0);";
    }

    //videothumb
    let col4img = '<img src="' + currDict.videoimgurl + '"></img>';
    col4 = '<a target="_blank" class="nvimgc" href="' + currDict.url + '">' + col4img + '</a>';

    if (currDict.read) {
        col5 = "checked";
        elemHTML = elemHTML.replace('notificationsRow', 'notificationsRow notificationRead');
    } else {
        col5 = "";
    }

    //Replace dummy values
    //LATER Can use ${var}
    elemHTML = elemHTML.replace("ROWDUMMYROW1", col1);
    elemHTML = elemHTML.replace("ROWDUMMYROW2", col2);
    elemHTML = elemHTML.replace("ROWDUMMYROW3", col3);
    elemHTML = elemHTML.replace("ROWDUMMYROW4", col4);
    elemHTML = elemHTML.replace("READCHECKED", col5);
    //Could have used a row number - id hashmap instead here
    elemHTML = elemHTML.replace("DUMMYDATASETID", currDict.id);

    document.querySelector("#innerNotifications").append(elemDiv);
    elemDiv.outerHTML = elemHTML;

    //add read checkbox click event
    document.querySelector(".notificationsRow:last-of-type paper-checkbox").addEventListener('click', checkboxReadClicked);
}

async function togglereadAll(event) {
    //console.log(event.target);
    let theCheckbox = event.target.closest("paper-checkbox");

    var r = confirm("Are you sure?");
    if (r != true) {
        theCheckbox.checked = !theCheckbox.checked;
        return;
    }

    let readvalue;
    if (theCheckbox.checked == true) {
        readvalue = true;
    } else {
        readvalue = false;
    }
    //use toArray() instead
    await db.notifications.toCollection().modify({
        "read": readvalue
    }).then(result => {
        //console.log("checked:" + readvalue);
    }).catch(Dexie.ModifyError, function(e) {
        console.error(e.failures.length + "failed to modify read value");
        throw e;
    });

    document.querySelectorAll(".notificationsRow").forEach(element => {
        if (readvalue) {
            element.classList.add("notificationRead");
        } else {
            element.classList.remove("notificationRead");
        }
        element.querySelector("paper-checkbox").checked = readvalue;
    });
    return;
}

async function checkboxReadClicked(event) {
    
    let eventRow = event.target.closest("div.notificationsRow");
    let rowId = eventRow.dataset.id;

    if (rowId == "" || !rowId) {
        console.log("Error while reading row ID");
        return "Error while reading row ID";
    }

    let readvalue;
    if (eventRow.querySelector("paper-checkbox").checked == true) {
        readvalue = true;
    } else {
        readvalue = false;
    }

    return await db.notifications.where("id").equals(rowId).modify({
        "read": readvalue
    }).then(result => {
        if (readvalue) {
            eventRow.classList.add("notificationRead");
        } else {
            eventRow.classList.remove("notificationRead");
        }
        return result;
    }).catch(Dexie.ModifyError, function(e) {
        console.error(e.failures.length + "failed to modify read value");
        throw e;
    });

}

function reversefromNow(input) {
    let relativeLocale = JSON.parse(JSON.stringify(moment.localeData()._relativeTime));
    let pastfutureObject = {
        future: relativeLocale.future,
        past: relativeLocale.past
    };
    delete relativeLocale.future;
    delete relativeLocale.past;

    //detect if past or future
    let pastfuture;
    for (const [key, value] of Object.entries(pastfutureObject)) {
        if (input.indexOf(value.replace("%s", "")) != -1) {
            pastfuture = key;
        }
    }

    //detect the time unit
    let unitkey;
    for (const [key, value] of Object.entries(relativeLocale)) {
        if (input.indexOf(value.replace("%d", "")) != -1) {
            unitkey = key.charAt(0);
        }
    }

    //if its not in the data, then assume that it is a week
    if (unitkey == null) {
        unitkey = "w";
    }

    const units = {
        M: "month",
        d: "day",
        h: "hour",
        m: "minute",
        s: "second",
        w: "week",
        y: "year"
    };
    //Detect number value 
    const regex = /(\d+)/g;
    let numbervalue = input.match(regex) || [1];
    //Add if future, subtract if past
    if (pastfuture == "past") {
        //console.log(`moment input: ${input}, output: ${moment().subtract(numbervalue, units[unitkey]).toString()}`);
        return moment().subtract(numbervalue, units[unitkey]).valueOf();
    } else {
        //console.log(`moment input: ${input}, output: ${moment().add(numbervalue, units[unitkey]).toString()}`);
        return moment().add(numbervalue, units[unitkey]).valueOf();
    }
}


function addStyles() {

    let newstyle = document.createElement("style");
    newstyle.innerHTML = `
    
    #outerNotifications {
        background-color: rgb(15, 15, 15);
        border: 2px rgb(15, 15, 15) solid;
        display: block;
        position: fixed;
        width: 75%;
        height: 75%;
        border-radius: 15px;
        z-index: 345;
        top: 50%;
        left: 50%;
        /*transform: translate(-50%, -50%);*/
        transform: translateX(calc(-50% - 0.5px)) translateY(calc(-50% - 0.5px));
        color: #ddd;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.35);
    }

    #sidebuttons {
        display: flex;
        flex-direction: column;
        font-size: 1.5em;
        position: absolute;
        top: 8px;
        left: 8px;
        width: 140px;
        background-color: #151515;
        height: calc(100% - 16px);
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16), 0 2px 4px rgba(0, 0, 0, 0.23);
        user-select: none;
    }

    #sidebuttonsTop {
        display: flex;
        flex-direction: column;
        margin-top: 12px;
    }
    
    #sidebuttonsBottom {
        display: flex;
        flex-direction: column;
        margin-top: auto;
        margin-bottom: 1em;
    }
    
    #innerNotifications {
        display: flex;
        flex-direction: column;
        overflow: auto;
        height: 97%;
        margin-top: 10px;
        margin-left: 154px;
        margin-right: 8px;
    }

    #innerNotifications a {
        color: #6c96cc;
        text-decoration-line: none;
    }

    #innerNotifications a:visited {
        color: #a56ccc;
    }

    .notificationsRow {
        margin-left: 0%;
        margin-right: 5%;
        margin-bottom: 4px;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-content: center;
        align-items: center;
        font-size: 1.5em;
    }
    /* same as .notificationsRow */

    #pagingButtons {
        margin-left: 0%;
        margin-right: 5%;
        margin-bottom: 4px;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-content: center;
        align-items: center;
        font-size: 1.5em;
    }

    .notifRowItem {
        display: flex;
        flex-direction: column;
        flex-basis: 100%;
        flex: 1;
        margin-right: 4px;
    }

    /*Set table css */
    .notcol1, .notcol4 {
        height: 120px;
        align-items: center;
        text-align: center;
    }

    .notcol1 {
        flex-grow: 0.9;
    }
    .notcol2 {
        flex-grow: 3;
    }
    .notcol3 {
        text-align: center;
        flex-grow: .8;
    }
    .notcol4 {
        flex-grow: 1;
    }
    .notcol5 {
        flex-grow: 0.7;
    }

    .notifRowItem img, .notifRowItem > a.nvimgc {
        width: 100%;
        height: 100%;
        object-fit: scale-down;
    }

    #sidebuttons paper-checkbox {
        min-height: 25px;
        margin-bottom: 0.5em;
    }

    #outerNotifications paper-checkbox {
        font-size: .85em;
        margin-left: 14px;
    }
    #outerNotifications paper-checkbox #checkboxLabel {
        color: #ddd;
        width: 66%;
        padding-left: 10px;
    }

    #sidebuttons paper-ripple {
        color: rgba(0, 0, 0, 0);
    }
    
    #sidebuttonsTop #searchContainer {
        display: flex;
        flex-direction: row;
    }
    
    #sidebarSearchInput {
        width: 89px;
        padding-right: 22px;
        height: 22px;
        margin: 6px -16px 22px 12px;
        background-color: #0F0F0F;
        border: 1px solid #303030;
        color: rgba(255, 255, 255, 0.88);
        padding-left: 4px;
        border-radius: 2px;
    }
    
    #sidebarSearchInput:focus {
        border: 1px solid #1C62B9;
    }

    #sidebarSearchButton {
        padding: 0px;
        top: 8px;
        left: -7px;
        height: 43%;
        width: 16%;
        color: rgba(255, 255, 255, 0.45);
    }
    `;
    document.head.append(newstyle);

    //POPUP options css
    newstyle = document.createElement("style");
    newstyle.id = "tabbedoptionscss";
    newstyle.innerHTML = `

    #backgroundOverlay {
        position: fixed;
        width: 200vw;
        height: 200vh;
        top: -100%;
        left: -100%;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.5);
        z-index: 2;
        cursor: pointer;
    }

    #notificationOptions {
        position: absolute;
        top: 50%;
        left: 50%;
        /*transform: translate(-50%, -50%);*/
        transform: translateX(calc(-50% - 0.5px)) translateY(calc(-50% - 0.5px));
        color: #ddd;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.35);
        background-color: rgb(30, 30, 30);
        border: 2px rgb(30, 30, 30) solid;
        display: block;
        width: 50%;
        height: 101%;
        border-radius: 15px;
        --paper-tabs-selection-bar-color: var(--paper-blue-a200);
    }

    #notificationOptions > iron-pages {
        margin: 0px 16px 16px 16px;
    }

    #notificationOptions paper-button {
        border: 1px #82c7f299 solid;
        font-size: 1.2em;
        margin: 4px auto 4px auto;
    }
    
    #notificationOptions .material-tabs {
        display: block;
        float: left;
        width: 100%;
        height: 100%;
    }
    
    #notificationOptions .visible {
        position: relative;
        opacity: 1;
        transition: opacity .35s ease;
        z-index: 3;
    }
    
    #notificationOptions .hidden {
        position: absolute;
        opacity: 0;
        transition: opacity 0s ease;
        z-index: 0;
    }
    
    #notificationOptions [class*="tabbed-section-"] {
        margin: 8px 16px 16px 16px;
        overflow-y: auto;
        overflow-x: hidden;
        width: calc(100% - 32px);
        height: calc(100% - 20px - 48px);
        display: flex;
        flex-direction: column;
    }
    
    #notificationOptions .tabbed-section__selector {
        position: relative;
        width: 100%;
        user-select: none;
        float: left;
        z-index: 5;
    }
    
    [class*="-tab-"] {
        line-height: 350%;
        float: left;
        display: block;
        width: 33%;
        text-align: center;
        font-weight: bold;
        text-decoration: none;
        font-size: 14px;
        cursor: pointer;
    }
    
    [class*="-tab-"].active {
        /*color: #4F2CCA;*/
    }
    
    .tabbed-section__highlighter {
        position: absolute;
        z-index: 10;
        bottom: 0;
        height: 2px;
        background: #448aff;
        max-width: 33%;
        width: 33%;
        transform: translateX(0);
        display: block;
        left: 0;
        transition: transform .13s ease;
    }
    
    .tabbed-section__selector-tab-3.active~.tabbed-section__highlighter {
        transform: translateX(200%);
    }
    
    .tabbed-section__selector-tab-2.active~.tabbed-section__highlighter {
        transform: translateX(100%);
    }
    
    .tabbed-section__selector-tab-1.active~.tabbed-section__highlighter {
        transform: translateX(0);
    }
    
    #notificationOptions .divider {
        background: rgba(0, 0, 0, .1);
        position: relative;
        display: block;
        float: left;
        width: 100%;
        height: 1px;
        margin: 8px 0;
        padding: 0;
        overflow: hidden;
    }
    
    #importDatabaseButton paper-ripple {
        display: none;
        transform: none;
        transition: none;
    }

    `;
    document.head.append(newstyle);
    //document.querySelector("#tabbedoptionscss").disabled = false;


    //Low Opacity livestreams css
    newstyle = document.createElement("style");
    newstyle.id = "livetransparencycss";
    newstyle.innerHTML = `
    .notificationLive {
        opacity: 36%;
    }
    `;
    document.head.append(newstyle);
    //Enabled by default
    //document.querySelector("#livetransparencycss").disabled = true;

    //Low Opacity read css
    newstyle = document.createElement("style");
    newstyle.id = "readtransparencycss";
    newstyle.innerHTML = `
    .notificationRead {
        opacity: 36%;
    }
    `;
    document.head.append(newstyle);
    //Enabled by default
    //document.querySelector("#readtransparencycss").disabled = true;

    //Low Opacity comment css
    newstyle = document.createElement("style");
    newstyle.id = "commenttransparencycss";
    newstyle.innerHTML = `
    .notificationComment {
        opacity: 36%;
    }
    `;
    document.head.append(newstyle);
    //Enabled by default
    //document.querySelector("#commenttransparencycss").disabled = true;

    //hide livestreams css
    newstyle = document.createElement("style");
    newstyle.id = "hidelivecss";
    newstyle.innerHTML = `
    .notificationLive {
        display: none;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#hidelivecss").disabled = true;

    //hide read notifications css
    newstyle = document.createElement("style");
    newstyle.id = "hidereadcss";
    newstyle.innerHTML = `
    .notificationRead {
        display: none;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#hidereadcss").disabled = true;

    //hide comments css
    newstyle = document.createElement("style");
    newstyle.id = "hiderepliescss";
    newstyle.innerHTML = `
    .notificationComment {
        display: none;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#hiderepliescss").disabled = true;

    //smaller notifications panel css
    newstyle = document.createElement("style");
    newstyle.id = "smallernotpanel";
    newstyle.innerHTML = `
    ytd-notification-renderer {
        height: 20px;
    }
    
    /*hide notifications panel*/
    iron-dropdown {
        /*z-index: -1 !important;*/
        opacity: 50%;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#smallernotpanel").disabled = true;


}

/* jshint ignore:start */
/* beautify ignore:start */
/* SmtpJS from https://smtpjs.com/v3/smtp.js start */

/* SmtpJS.com - v3.0.0 */
var Email = { send: function (a) { return new Promise(function (n, e) { a.nocache = Math.floor(1e6 * Math.random() + 1), a.Action = "Send"; var t = JSON.stringify(a); Email.ajaxPost("https://smtpjs.com/v3/smtpjs.aspx?", t, function (e) { n(e) }) }) }, ajaxPost: function (e, n, t) { var a = Email.createCORSRequest("POST", e); a.setRequestHeader("Content-type", "application/x-www-form-urlencoded"), a.onload = function () { var e = a.responseText; null != t && t(e) }, a.send(n) }, ajax: function (e, n) { var t = Email.createCORSRequest("GET", e); t.onload = function () { var e = t.responseText; null != n && n(e) }, t.send() }, createCORSRequest: function (e, n) { var t = new XMLHttpRequest; return "withCredentials" in t ? t.open(e, n, !0) : "undefined" != typeof XDomainRequest ? (t = new XDomainRequest).open(e, n) : t = null, t } };

/* SmtpJS end */
/* jshint ignore:end */
/* beautify ignore:end */

function testEmail() {
    let videoDictArray = [];

    //regular example + live, liveicon will be added.
    let testDict = {
        url: "https://www.youtube.com/watch?v=L13gCEZJVRU",
        title: "Orangestar uploaded: Orangestar - Henceforth (feat. IA) Official Lyric Video",
        time: 1598443875891,
        userimgurl: "https://yt3.ggpht.com/a/AATXAJzXpZj3-Ka__n-cwUcbWUKfo0QOvm4Uf6S7WADJ=s0",
        videoimgurl: "https://i.ytimg.com/vi/L13gCEZJVRU/hqdefault.jpg",
        live: true,
        read: false,
        notvideo: false,
    };
    videoDictArray.push(testDict);

    //multi url example, url will get split
    testDict = {
        url: "https://www.youtube.com/watch_videos?video_ids=SZ_q3EC-YJ4,tSgrOcejiUs,skCiZ9IJmZY&type=0&title=幽閉サテライト&少女フラクタル+公式チャンネル",
        title: "Just grab the title from the urls",
        time: 1598443875891,
        userimgurl: "https://yt3.ggpht.com/a/AATXAJzXpZj3-Ka__n-cwUcbWUKfo0QOvm4Uf6S7WADJ=s0",
        videoimgurl: "https://i.ytimg.com/vi/notherethough/hqdefault.jpg",
        live: false,
        read: false,
        notvideo: false,
    };
    videoDictArray.push(testDict);

    //comment example, notvideo value is checked.
    testDict = {
        url: "https://www.youtube.com/watch?v=a5ALRhNbYFM",
        title: 'NotARealPerson replied: "JUST fetch the data man."',
        time: 1598443875891,
        userimgurl: "https://yt3.ggpht.com/a/AATXAJxFuolf88nRiuIaRcc87kfdyBN729Z4sUGux4in=s0",
        videoimgurl: "https://i.ytimg.com/vi/a5ALRhNbYFM/hqdefault.jpg",
        live: false,
        read: false,
        notvideo: true,
    };
    videoDictArray.push(testDict);

    console.log("testEmail -> videoDictArray", videoDictArray);

    // videoDictArray.forEach(element => {
    //     console.log("testEmail -> element", element);
    //     Object.entries(element).forEach(element => {
    //         console.log("testEmail -> element", element);
    //     });
    // });

    const sendingemail = sendEmailBatch(videoDictArray).then(function(result) {
        console.log("TEST EMAILS SENT.");
        return result;
    });
}

async function sendEmailBatch(videoDictArray) {

    if (videoDictArray.length > dontSendEmailsOver) {
        console.error(`You have over ${dontSendEmailsOver} new videos. The action of sending emails was cancelled.`);
        return;
    }
    if (videoDictArray.length == 0) {
        return;
    }

    //console.log("sendEmailBatch -> videoDictArray", videoDictArray);

    //handle multiple urls, replies/comments
    let emailSendArray = [];
    for (let i = 0; i < videoDictArray.length; i++) {

        //---handle Url types---

        if (videoDictArray[i].url.indexOf("video_ids") != -1) {
            //handle https://www.youtube.com/watch_videos?video_ids=SZ_q3EC-YJ4,tSgrOcejiUs,skCiZ9IJmZY&type=0&title=幽閉サテライト&少女フラクタル+公式チャンネル
            let matchedIDs = videoDictArray[i].url.match(/video_ids=(.*?)(&|$)/)[1];
            matchedIDs = matchedIDs.split(",");

            for (let j = 0; j < matchedIDs.length; j++) {
                const videoID = matchedIDs[j];
                let cloneDict = JSON.parse(JSON.stringify(videoDictArray[i]));
                cloneDict.url = 'https://www.youtube.com/watch?v=' + videoID;
                emailSendArray.push(cloneDict);
            }

        } else {
            //Don't handle regular urls & others if they exist
            // https://www.youtube.com/watch?v=BorBtFVvzbk
            emailSendArray.push(videoDictArray[i]);
        }
    }

    console.log("sendEmailBatch -> emailSendArray", emailSendArray);

    //Email batch size. Keep it low
    let emailBatchSize = 4;
    for (let i = 0; i < emailSendArray.length; i += emailBatchSize) {

        //Not async
        const emailBatch = emailSendArray.slice(i, i + emailBatchSize).map((videoDict) => {
            return sendEmail(videoDict)
                .catch(e => {
                    console.log(`Error in sending email for ${videoDict} - ${e}`);
                });
        });

        await Promise.all(emailBatch)
            .catch(e => {
                console.log(`Error in sending email for the batch ${i} - ${e}`);
            });
    }

}

async function sendEmail(videoDict) {

    //no need to clone videoDict

    console.log("sendEmail -> videoDict", videoDict, Date.now());

    let channelName = "",
        channelURL = "",
        vidLength = "";

    //Use fetch to get the video data
    //This can be seperated into its own function if needed.
    await fetch(videoDict.url).then(function(response) {
        return response.text();
    }).then(function(newhtml) {

        //raw html for debug
        emailhtml = newhtml;
        // Convert the HTML string into a document object
        var parser = new DOMParser();

        let emaildoc = parser.parseFromString(newhtml, 'text/html');
        
        let ytInitialData_PARSED, ytInitialPlayerResponse_PARSED;
        for (let scriptindex = 0; scriptindex < emaildoc.scripts.length; scriptindex++) {
            const thescript = emaildoc.scripts[scriptindex];
            //LATER: Could use eval() or parse()

            //combined OLD method
            if (thescript.innerHTML.indexOf('window["ytInitialData"]') != -1) {
                // Also thescript.innerHTML.match(/window\[\"ytInitialData\"\] = (.*);\n\s*window\[\"ytInitialPlayerResponse/)[1];
                ytInitialData_PARSED = JSON.parse(thescript.innerHTML.split("window[\"ytInitialData\"] = ")[1].split("ytInitialPlayerResponse")[0].split(";\n")[0]);
                // Also ... 
                ytInitialPlayerResponse_PARSED = JSON.parse(thescript.innerHTML.split("window[\"ytInitialPlayerResponse\"] = ")[1].split("window.ytcsi")[0].split(";\n")[0]);
            }

            //YTinitialdata NEW method
            if (thescript.innerHTML.indexOf('var ytInitialData = ') != -1) {
                // Also thescript.innerHTML.match(/window\[\"ytInitialData\"\] = (.*);\n\s*window\[\"ytInitialPlayerResponse/)[1];
                ytInitialData_PARSED = JSON.parse(thescript.innerHTML.split("var ytInitialData = ")[1].slice(0, -1));

            }

            //ytInitialPlayerResponse NEW method
            if (thescript.innerHTML.indexOf('var ytInitialPlayerResponse = ') != -1) {
                ytInitialPlayerResponse_PARSED = JSON.parse(thescript.innerHTML.split("var ytInitialPlayerResponse = ")[1].split(";var meta = document.createElement('meta')")[0]);

            }


        }

        //Get the best possible values from the fetched page.
        //Might be useless to double check but they can stay just in case.

        // Handle videoDict.title 
        // DONE Comments should not change their titles.
        if (!videoDict.notvideo) {
            let newTitle = ytInitialPlayerResponse_PARSED.videoDetails.title ||
                           ytInitialData_PARSED.contents.twoColumnWatchNextResults.results.results.contents[0].videoPrimaryInfoRenderer.title.runs[0].text ||
                           newhtml.match(/<meta (property|name)="(og|twitter):title" content="(.*?)">/)[3];
            if (newTitle) {
                videoDict.title = newTitle;
            }
        }

        // Handle channelName
        let newChannelName = ytInitialPlayerResponse_PARSED.videoDetails.author ||
            ytInitialPlayerResponse_PARSED.microformat.playerMicroformatRenderer.ownerChannelName;
        if (newChannelName) {
            channelName = newChannelName;
        }

        // Handle video length
        vidLength = ytInitialPlayerResponse_PARSED.videoDetails.lengthSeconds || ytInitialPlayerResponse_PARSED.microformat.playerMicroformatRenderer.lengthSeconds;
        //format vid length from seconds
        vidLength = moment.utc(vidLength * 1000).format('HH:mm:ss').replace(/^(00:)/, "");

        //handle userimgurl
        let newUserImgUrl = ytInitialData_PARSED.contents.twoColumnWatchNextResults.results.results.contents[1].videoSecondaryInfoRenderer.owner.videoOwnerRenderer.thumbnail.thumbnails.slice(-1)[0].url.replace(/=s\d.*/, "=s0") || videoDict.userimgurl;
        if (newUserImgUrl) {
            videoDict.userimgurl = newUserImgUrl;
            //Fix for example: "//yt3.ggpht.com/ytc/AAUvwngNRbQ0wRc8flYiQfOm1FFhLB1aghNa2WJs4uOD=s0"
            if (videoDict.userimgurl.match(/^\/\/.*?=s0$/)) {
                videoDict.userimgurl = "https:" + videoDict.userimgurl;
            }
        }

        //handle videoDict.videoimgurl
        let newVideoImgUrl = ytInitialPlayerResponse_PARSED.videoDetails.thumbnail.thumbnails.slice(-1)[0].url || ytInitialPlayerResponse_PARSED.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url || videoDict.videoimgurl;
        if (newVideoImgUrl) {
            videoDict.videoimgurl = newVideoImgUrl;
        }

        // Handle channel url
        channelURL = ytInitialPlayerResponse_PARSED.microformat.playerMicroformatRenderer.ownerProfileUrl;
        if (channelURL == null) {
            if (ytInitialPlayerResponse_PARSED.videoDetails.channelId != null) {
                channelURL = "https://www.youtube.com/channel/" + ytInitialPlayerResponse_PARSED.videoDetails.channelId;
            }
        }
        return;

    }).catch(function(err) {
        // There was an error
        console.warn('Something went wrong while fetching video data.', err);
    });

    // console.log("sendEmail -> channelName", channelName);
    // console.log("sendEmail -> channelURL", channelURL);
    // console.log("sendEmail -> vidLength", vidLength);
    // console.log("sendEmail -> videoimgurl", videoDict.videoimgurl);
    // console.log("sendEmail -> videoDict.userimgurl", videoDict.userimgurl);
    // console.log("sendEmail -> videoDict.title", videoDict.title);

    const emailSettings = await db.settings
        .where('key')
        .equals("email")
        .toArray();

    //console.log(emailSettings[0].value);

    //using regex detect the category+videotitle
    //This is useless because we fetch the title anyways
    //comments should stay as is. // reply: /.*? replied: (.*)/,
    let regexDict = {
        live: /.*? is live: (.*)/,
        upload: /.*? uploaded: (.*)/,
        premier: /.*? premiering now: (.*)/,
    };

    for (const [key, value] of Object.entries(regexDict)) {
        if (videoDict.title.match(value) != null) {
            videoDict.title = videoDict.title.match(value)[1];
        }
    }

    //Handle live
    //add red dot and space for replacing. Otherwise deletes the DUMMYLIVEICON dummy value
    let liveIcon = "";
    if (videoDict.live) {
        liveIcon = liveTitlePrependString;
    }

    let replaceThese = {
        DUMMYVIDEOTITLE: videoDict.title,
        DUMMYVIDEOIMAGEURL: videoDict.videoimgurl,
        DUMMYVIDEOLENGTH: vidLength,
        DUMMYVIDEOURL: videoDict.url,
        DUMMYCHANNELIMAGEURL: videoDict.userimgurl,
        DUMMYCHANNELNAME: channelName,
        DUMMYCHANNELURL: channelURL,
        DUMMYLIVEICON: liveIcon,
    };

    console.log("sendEmail -> replaceThese", replaceThese);

    let subjectVal = emailSettings[0].value.Subject;
    let bodyVal = emailSettings[0].value.Body;
    //Replace all of the dummy values
    for (const [key, value] of Object.entries(replaceThese)) {
        subjectVal = subjectVal.replaceAll(key, value);
        bodyVal = bodyVal.replaceAll(key, value);
    }

    if (ytbnDebugEmail) {
        return "ytbnDebugEmail";
    }

    let emailSendResponse;
    let retryEmail = 0;

    do {

        if (emailGAPIReady) {

            emailSendResponse = await emailGAPI.sendMessage(
                emailSettings[0].value.To,
                emailSettings[0].value.From,
                subjectVal,
                bodyVal
            ).then(message => {
                console.log("Email.send response: ");
                console.log(message);
                return message;
            });

        } else if (useEmailSecureToken) {

            emailSendResponse = await Email.send({
                SecureToken: emailSettings[0].value.SecureToken,
                To: emailSettings[0].value.To,
                From: emailSettings[0].value.From,
                Subject: subjectVal,
                Body: bodyVal,
            }).then(message => {
                console.log("Email.send response: " + message);
                return message;
            });

        } else {

            emailSendResponse = await Email.send({
                Host: emailSettings[0].value.Host,
                Username: emailSettings[0].value.Username,
                Password: emailSettings[0].value.Password,
                From: emailSettings[0].value.From,
                To: emailSettings[0].value.To,
                Subject: subjectVal,
                Body: bodyVal,
            }).then(message => {
                console.log("Email.send response: " + message);
                return message;
            });
        }

        let emailData = {
            replaceThese
        };

        let logDict = {
            type: "Email_Send",
            time: moment().format("YYYY-MM-DD HH:mm:SSS"),
            extra: emailData,
            log: emailSendResponse,
        };

        //DONE log successful emails as well
        const logput = await db.logs.put(logDict);
        console.log("sendEmail -> logDict, logput", logDict, logput);

        //console.log("sendEmail -> emailSendResponse", emailSendResponse);
        //retry sending email up to 3 times
        //LATER gmail status text might have to be "SENT" instead
        console.log("sendEmail -> emailSendResponse BELOW");
        console.log(emailSendResponse);
        console.log("sendEmail -> retryEmail", retryEmail);
        if ((emailSendResponse != "OK") && (emailSendResponse.statusText != "OK")) {
            if (retryEmail == 0) {
                retryEmail = 1;
            } else {
                retryEmail++;
            }
        } else {
            retryEmail = 999;
        }
    } while (retryEmail <= 2);

    return emailSendResponse;

    // (extras for Email.send)    
    // Attachments: [{
    //     name : "smtpjs.png",
    //     path:"https://networkprogramming.files.wordpress.com/2017/11/smtpjs.png"
    // }]
}

async function readSettings() {

    try {
        //read email options (only the ones needed)
        await db.settings
            .where('key')
            .equals("email")
            .toArray().then(emailSettings => {
                if (emailSettings == null) {
                    return;
                }
                shouldSendEmail = emailSettings[0].value.SendEmail;
                useEmailSecureToken = emailSettings[0].value.UseSecureToken;
                GAPIClientID = emailSettings[0].value.GAPIid;
                GAPIClientKey = emailSettings[0].value.GAPIkey;
                return;
            });

        //load GAPI if they are present
        if (GAPIClientID && GAPIClientKey) {
            await emailGAPI.handleClientLoad();
        }

    } catch (error) {
        console.log("readSettings error:", error);
    }

}

function saveOptionsEmail() {

    shouldSendEmail = document.querySelector("#sendEmailCheckbox").checked;
    useEmailSecureToken = document.querySelector("#useSecureTokenCheckbox").checked;

    GAPIClientID = document.querySelector("#emailGAPIClientID").value;
    GAPIClientKey = document.querySelector("#emailGAPIClientKey").value;

    let settingsDict = {
        key: "email",
        value: {
            GAPIid: GAPIClientID,
            GAPIkey: GAPIClientKey,
            Host: document.querySelector("#emailHost").value,
            Username: document.querySelector("#emailUsername").value,
            Password: document.querySelector("#emailPassword").value,
            From: document.querySelector("#emailFrom").value,
            To: document.querySelector("#emailTo").value,
            Subject: document.querySelector("#emailSubject").value,
            Body: document.querySelector("#emailBody").value,
            SecureToken: document.querySelector("#emailSecureToken").value,
            SendEmail: shouldSendEmail,
            UseSecureToken: useEmailSecureToken,
        },
        extra: "",
    };

    db.settings.put(settingsDict).then(result => {
        return result;
    });
}

var emailGAPI = {

    handleClientLoad: async function handleClientLoad() {
        if (!gapi.auth2) {
            gapi.load('client:auth2');
        }
        emailGAPI.initClient();
    },

    initClient: async function initClient() {
        // Client ID and API key
        var CLIENT_ID = GAPIClientID;
        var API_KEY = GAPIClientKey;

        // Array of API discovery doc URLs for APIs used by the quickstart
        var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];

        // Authorization scopes required by the API; multiple scopes can be
        // included, separated by spaces.
        var SCOPES = 'https://www.googleapis.com/auth/gmail.send';

        gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
        }).then(function() {

            // Handle the initial sign-in state.
            emailGAPI.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

            // Listen for sign-in state changes.
            gapi.auth2.getAuthInstance().isSignedIn.listen(emailGAPI.updateSigninStatus);

        }, function(error) {
            //LATER errors to the database instead
            emailGAPIReady = false;
            console.log(JSON.stringify(error, null, 2));
        });
    },


    /**
     *  Called when the signed in status changes, to update the UI
     *  appropriately. After a sign-in, the API is called.
     */
    updateSigninStatus: function updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
            emailGAPIReady = true;
            if (document.querySelector("#notificationOptions") != null) {
                document.querySelector("#notificationOptions #authButtonEmail").style.display = 'none';
                document.querySelector("#notificationOptions #signoutButtonEmail").style.display = 'block';
            }
        } else {
            emailGAPIReady = false;
            if (document.querySelector("#notificationOptions") != null) {
                document.querySelector("#notificationOptions #authButtonEmail").style.display = 'block';
                document.querySelector("#notificationOptions #signoutButtonEmail").style.display = 'none';
            }
        }
    },

    /**
     *  Sign in the user upon button click.
     */
    handleAuthClick: async function handleAuthClick(event) {

        GAPIClientID = document.querySelector("#emailGAPIClientID").value;
        GAPIClientKey = document.querySelector("#emailGAPIClientKey").value;
        gapi.auth2.getAuthInstance().signIn();
    },

    /**
     *  Sign out the user upon button click.
     */
    handleSignoutClick: async function handleSignoutClick(event) {
        gapi.auth2.getAuthInstance().signOut();
    },


    /**
     * Send Email
     */
    sendMessage: async function sendMessage(emailTo, emailFrom, emailSubject, message) {

        //Subject has to be in the following format: Subject: =?utf-8?B?${Base64.encodeURI(emailSubject)}?=

        var rawEmail = `To: ${emailTo}
From: ${emailFrom}
Subject: =?utf-8?B?${Base64.encode(emailSubject)}?=
Content-Type: text/html; charset=UTF-8
MIME-Version: 1.0

${message}`;

        //We use a Base64 library because btoa does not work for all utf-8 characters
        rawEmail = Base64.encodeURI(rawEmail);

        var sendRequest = gapi.client.gmail.users.messages.send({
            'userId': 'me',
            'resource': {
                'raw': rawEmail
            }
        });

        return sendRequest;
    }

};


function setupNotificationDiv() {
    let innerNotificationsDiv = document.createElement("div");
    let outerNotificationsDiv = document.createElement("div");
    outerNotificationsDiv.id = "outerNotifications";
    innerNotificationsDiv.id = "innerNotifications";

    const divHTML = `
    <div id="sidebuttons">
        <div id="sidebuttonsTop">
            <!-- LATER fix search functionality, bring "download additional data" button with it (channel names mostly (but we can get the channel names from TITLE???))
            <div id="searchContainer">                
                <input label="Filter" id="sidebarSearchInput" placeholder="Filter">
                    <paper-icon-button slot="suffix" id="sidebarSearchButton" icon="search" alt="Filter" title="Filter">
                    </paper-icon-button>
                </input>
            </div>
            -->
            <div id="livesideButtons" style="border: 2px #3EA6FF44 solid;border-radius: 8px;margin: 0px 8px 6px 8px;">
                <div style="position: absolute;margin: -12px 0px 0px 24px;font-size: 10pt;background: #151515;padding: 1px;">Livestreams</div>
                <paper-checkbox style="margin-top: calc(0.5em + 4px);" id="hideliveCheckbox" noink>Hide</paper-checkbox>
                <paper-checkbox style="" id="livetransparencyCheckbox" noink checked>Opacity</paper-checkbox>
            </div>
            <div id="readsideButtons" style="border: 2px #3EA6FF44 solid;border-radius: 8px;margin: 8px 8px 6px 8px;">
                <div style="position: absolute;margin: -12px 0px 0px 24px;font-size: 10pt;background: #151515;padding: 1px;">Read</div>
                <paper-checkbox style="margin-top: calc(0.5em + 4px);" id="hidereadCheckbox" noink>Hide</paper-checkbox>
                <paper-checkbox style="" id="readtransparencyCheckbox" noink checked>Opacity</paper-checkbox>
            </div>
            <div id="commentsideButtons" style="border: 2px #3EA6FF44 solid;border-radius: 8px;margin: 8px 8px 6px 8px;">
                <div style="position: absolute;margin: -12px 0px 0px 24px;font-size: 10pt;background: #151515;padding: 1px;">Comments</div>
                <paper-checkbox style="margin-top: calc(0.5em + 4px);" id="hiderepliesCheckbox" noink">Hide</paper-checkbox>
                <paper-checkbox style="" id="commenttransparencyCheckbox" noink checked>Opacity</paper-checkbox>
            </div>
            
        </div>
        <div id="sidebuttonsBottom">
            <paper-button id="displayOptionsButton" raised class="" style="border: 1px #82c7f299 solid;font-size: .8em;text-align: center;margin: 12px 12px 1em 12px;">SETTINGS</paper-button>
            <paper-checkbox style="margin-top: 2em; margin-left: 24px;" id="readallCheckbox" noink>Toggle All Read/Unread</paper-checkbox>
        </div>
    </div>
    <div id="loadindicator" style="top: 43%;left: 46%;position: absolute;">
        <paper-spinner active style="width: 70px;height: 70px;"></paper-spinner>
        <div style="font-size:2em;text-align: center;margin-left: -60%;margin-top: 6px;">
            Loading...
            <br>
            Do not click anywhere...
            <br>
            Do not do anything...
        </div>
    </div>
    <div id="innerNotifications">
    </div>
    `;
    document.querySelector("body").append(outerNotificationsDiv);
    outerNotificationsDiv.innerHTML = divHTML;
    document.querySelector("#sidebuttons #readallCheckbox").addEventListener('click', togglereadAll);
    document.querySelector("#sidebuttons #hideliveCheckbox").addEventListener('click', hideLive);
    document.querySelector("#sidebuttons #hidereadCheckbox").addEventListener('click', hideRead);
    document.querySelector("#sidebuttons #hiderepliesCheckbox").addEventListener('click', hideReplies);
    document.querySelector("#sidebuttons #livetransparencyCheckbox").addEventListener('click', livetransparency);
    document.querySelector("#sidebuttons #readtransparencyCheckbox").addEventListener('click', readtransparency);
    document.querySelector("#sidebuttons #commenttransparencyCheckbox").addEventListener('click', commenttransparency);
    document.querySelector("#sidebuttons #displayOptionsButton").addEventListener('click', displayTabbedOptions);
    //LATER fix search 2
    // document.querySelector("#sidebuttons #sidebarSearchButton").addEventListener('click', sidebarSearch);
    // document.querySelector("#sidebuttons #sidebarSearchInput").addEventListener('keyup', sidebarInputkey);
    return "pagination";
}

function useTokenCheckboxClicked(event) {
    if (document.querySelector("#useSecureTokenCheckbox").checked) {
        document.querySelector("#notificationOptions #emailHost").disabled = true;
        document.querySelector("#notificationOptions #emailUsername").disabled = true;
        document.querySelector("#notificationOptions #emailPassword").disabled = true;
        document.querySelector("#notificationOptions #emailSecureToken").disabled = false;
    } else {
        document.querySelector("#notificationOptions #emailHost").disabled = false;
        document.querySelector("#notificationOptions #emailUsername").disabled = false;
        document.querySelector("#notificationOptions #emailPassword").disabled = false;
        document.querySelector("#notificationOptions #emailSecureToken").disabled = true;
    }

}

function sidebarSearch(event) {
    console.log(event);
    console.log(event.target);

}

function sidebarInputkey(event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        document.querySelector("#sidebuttons #sidebarSearchButton").click();
    }
}

async function setupPaginationButtons() {

    let pagingButtonsDiv = document.createElement("div");
    let divHTML = `
    <div id="pagingButtons">
        <div class="notifRowItem" style="flex-grow: 0.7;">
            <paper-button id="firstpageButton" raised class="" style="border: 1px #82c7f299 solid;font-size: .8em;text-align: center;margin: 12px 12px 12px 12px;">First Page</paper-button>
        </div>
        <div class="notifRowItem" style="flex-grow: 1;">
        </div>
        <div class="notifRowItem">
            <paper-button id="previouspageButton" raised class="" style="border: 1px #82c7f299 solid;font-size: .8em;text-align: center;margin: 12px 12px 12px 12px;">Previous Page</paper-button>
        </div>
        <div class="notifRowItem" style="flex-grow: 0.5;">
            <div id="pageNumber" style="text-align: center;font-size: 1.5em;">
                CURRENTPAGENUMBER
            </div>
        </div>
        <div class="notifRowItem">
            <paper-button id="nextpageButton" raised class="" style="border: 1px #82c7f299 solid;font-size: .8em;text-align: center;margin: 12px 12px 12px 12px;">Next Page</paper-button>
        </div>
        <div class="notifRowItem" style="flex-grow: 1;">
        </div>
        <div class="notifRowItem" style="flex-grow: 0.7;">
            <paper-button id="lastpageButton" raised class="" style="border: 1px #82c7f299 solid;font-size: .8em;text-align: center;margin: 12px 12px 12px 12px;">Last Page</paper-button>
        </div>
    </div>
    `;
    divHTML = divHTML.replace('CURRENTPAGENUMBER', currentPage + 1);

    document.querySelector("#innerNotifications").append(pagingButtonsDiv);
    pagingButtonsDiv.innerHTML = divHTML;

    document.querySelector("#pagingButtons #previouspageButton").addEventListener('click', previousPage);
    document.querySelector("#pagingButtons #nextpageButton").addEventListener('click', nextPage);
    document.querySelector("#pagingButtons #firstpageButton").addEventListener('click', firstPage);
    document.querySelector("#pagingButtons #lastpageButton").addEventListener('click', lastPage);

    //no need to set them back to 100% as they redraw
    if (currentPage == maxPages - 1) {
        document.querySelector("#nextpageButton").style.opacity = "40%";
        document.querySelector("#lastpageButton").style.opacity = "40%";
    }
    if (currentPage == 0) {
        document.querySelector("#previouspageButton").style.opacity = "40%";
        document.querySelector("#firstpageButton").style.opacity = "40%";
    }
}

function displayTabbedOptions() {

    if (document.querySelectorAll("#notificationOptions").length != 0) {
        return;
    }

    let optionsDiv = document.createElement("div");
    optionsDiv.id = "notificationOptions";

    const optionsHTML = `
    <div id="backgroundOverlay"></div>
    <div class="material-tabs">
        <div class="tabbed-section__selector">
            <a class="tabbed-section__selector-tab-1 active">GENERAL</a>
            <a class="tabbed-section__selector-tab-2">EMAIL</a>
            <a class="tabbed-section__selector-tab-3">ADVANCED</a>
            <span class="tabbed-section__highlighter"></span>
        </div>

        <div class="tabbed-section-1 visible">
            <paper-button id="loadallButton" raised class="" style="margin-top:auto;">LOAD ALL NOTIFICATIONS</paper-button>
            <paper-button class="closeButtonSettings" raised class="" style="margin-top:auto;margin-bottom:0px;">CLOSE</paper-button>
        </div>
        <div class="tabbed-section-2 hidden">
            <div style="display: flex;flex-direction: column;">
                <paper-textarea id="emailGAPIClientID" label="Client ID (Example: xxxx-xxxxxxxx.apps.googleusercontent.com)"></paper-textarea>
                <paper-textarea id="emailGAPIClientKey" label="API Key or Secret (Example: xxxxxxxxxxxxxx)"></paper-textarea>
                <paper-button id="authButtonEmail" raised class="" style="margin-top:14px;margin-bottom:0px;display:none;">AUTHORIZE</paper-button>
                <paper-button id="signoutButtonEmail" raised class="" style="margin-top:14px;margin-bottom:0px;display:none;">SIGN OUT</paper-button>
                <paper-textarea id="emailTo" label="To (Example: MyUsername@gmail.com)"></paper-textarea>
                <paper-textarea id="emailFrom" label="From (Example: MyUsername@gmail.com)"></paper-textarea>
                <paper-textarea id="emailSubject" label="Subject (Can use DUMMY values. Example: DUMMYCHANNELNAME has a new video: DUMMYVIDEOTITLE)"></paper-textarea>
                <paper-textarea id="emailBody" label="Body (Can use HTML as well as DUMMY values.)"></paper-textarea>
                <h3>❗❗❗ DUMMYVIDEOTITLE, DUMMYVIDEOIMAGEURL, DUMMYVIDEOLENGTH, DUMMYVIDEOURL, DUMMYCHANNELIMAGEURL, DUMMYCHANNELNAME, DUMMYCHANNELURL, DUMMYLIVEICON strings will be replaced by their respective values when an email is sent. Only for the Subject and the Body.</h3>
                <paper-checkbox id="sendEmailCheckbox" noink style="--paper-checkbox-ink-size:54px;font-size: 12pt;margin-top: 8px;">Send Email on New Notifications</paper-checkbox>
                <paper-button id="saveButtonEmail" raised class="" style="margin-top:14px;margin-bottom:0px;">SAVE</paper-button>
                <paper-button id="sendEmailButton" raised class="" style="margin-top:14px;margin-bottom:14px;">SEND TEST EMAILS</paper-button>
                <paper-button class="closeButtonSettings" raised class="" style="margin-top:auto;margin-bottom:8px;">CLOSE</paper-button>
                <br>
                <h1 style="margin: 50px auto 30px auto;color: crimson;border: 1px red solid;border-radius: 4px;">Below Options are for SMTPJS. Please Ignore them.</h1>
                <br>
                <paper-textarea id="emailHost" label="Host (Example: smtp.gmail.com)"></paper-textarea>
                <paper-textarea id="emailUsername" label="Username (Example: MyUsername or MyUsername@gmail.com)"></paper-textarea>
                <paper-textarea id="emailPassword" label="Password (Example: MyPassword)"></paper-textarea>
                <paper-checkbox id="useSecureTokenCheckbox" noink style="--paper-checkbox-ink-size:54px;font-size: 12pt;margin-top: 8px;">Use Security Token Instead (visit smtpjs.com)</paper-checkbox>
                <paper-textarea id="emailSecureToken" label="Secure Token (Example: C973D7AD-F097-4B95-91F4-40ABC5567812)" disabled></paper-textarea>
                <paper-button class="closeButtonSettings" raised class="" style="margin-top:auto;margin-bottom:8px;">CLOSE</paper-button>
            </div>
        </div>
        <div class="tabbed-section-3 hidden">
            <div style="text-align:center;font-size:14pt;margin-top: auto;margin-bottom: 10px;">Be careful with your exported smtp passwords.</div>
            <paper-button id="exportDatabaseButton" raised class="" style="">EXPORT DATABASE</paper-button>
            <input type="file" id="importinput" name="importinput" accept=".json" style="width:50%;margin-left:auto;margin-right: auto;">
            <paper-button for="importinput" id="importDatabaseButton" class="" style="">IMPORT DATABASE</paper-button>
            <br>
            <br>
            <br>
            <paper-button id="discardNotificationsButton" raised class="" style="margin-top:auto;">CLEAR ALL NOTIFICATIONS</paper-button>
            <paper-button id="discardSettingsButton" raised class="" style="margin-top:12px;">CLEAR ALL SETTINGS</paper-button>
            <paper-button class="closeButtonSettings" raised class="" style="margin-top:auto;margin-bottom:0px;">CLOSE</paper-button>
        </div>
    </div>
    `;

    document.querySelector("#outerNotifications").append(optionsDiv);
    optionsDiv.innerHTML = optionsHTML;

    document.querySelector("#notificationOptions #importinput").outerHTML = document.querySelector("#notificationOptions #importinput").outerHTML.replace("<input", "<paper-input");

    document.querySelector("#notificationOptions #discardNotificationsButton").addEventListener('click', discardNotifications);
    document.querySelector("#notificationOptions #discardSettingsButton").addEventListener('click', discardSettings);
    document.querySelector("#notificationOptions #saveButtonEmail").addEventListener('click', saveOptionsEmail);
    document.querySelector("#notificationOptions #loadallButton").addEventListener('click', loadAll);
    document.querySelector("#notificationOptions #sendEmailButton").addEventListener('click', testEmail);
    document.querySelector("#notificationOptions #exportDatabaseButton").addEventListener('click', exportDB);
    document.querySelector("#notificationOptions #importDatabaseButton").addEventListener('click', importDB);
    document.querySelector("#notificationOptions #useSecureTokenCheckbox").addEventListener('click', useTokenCheckboxClicked);

    let authorizeButton = document.querySelector("#notificationOptions #authButtonEmail");
    let signoutButton = document.querySelector("#notificationOptions #signoutButtonEmail");
    authorizeButton.addEventListener('click', emailGAPI.handleAuthClick);
    signoutButton.addEventListener('click', emailGAPI.handleSignoutClick);

    if (emailGAPIReady) {
        signoutButton.style.display = 'block';
    } else {
        authorizeButton.style.display = 'block';
    }

    document.querySelector("#notificationOptions #importinput").addEventListener('change', fileInputOnchange);

    //Close button click events
    document.querySelectorAll("#notificationOptions .closeButtonSettings").forEach(item => {
        item.addEventListener('click', event => {
            document.querySelector("#notificationOptions").remove();
        });
    });

    //backgroundOverlay is the same as close button
    document.querySelector("#notificationOptions #backgroundOverlay").addEventListener('click', event => {
        document.querySelector("#notificationOptions").remove();
    });

    /* Base tabbed material panel from https://codepen.io/LukyVj/pen/yNwgrK */
    // TOGGLE SECTIONS  
    // Define tabs, write down them classes
    var tabs = [
        '.tabbed-section__selector-tab-1',
        '.tabbed-section__selector-tab-2',
        '.tabbed-section__selector-tab-3'
    ];

    // Create the toggle function
    var toggleTab = function(element) {
        var parent = element.parentNode;

        // Do things on click
        document.querySelectorAll(element)[0].addEventListener('click', function() {
            // Remove the active class on all tabs.
            // climbing up the DOM tree with `parentNode` and target 
            // the children ( the tabs ) with childNodes
            this.parentNode.childNodes[1].classList.remove('active');
            this.parentNode.childNodes[3].classList.remove('active');
            this.parentNode.childNodes[5].classList.remove('active');

            // Then, give `this` (the clicked tab), the active class
            this.classList.add('active');

            // Check if the clicked tab contains the class of the 1 or 2
            if (this.classList.contains('tabbed-section__selector-tab-1')) {
                // and change the classes, show the first content panel
                document.querySelectorAll('.tabbed-section-1')[0].classList.remove('hidden');
                document.querySelectorAll('.tabbed-section-1')[0].classList.add('visible');

                // Hide the second
                document.querySelectorAll('.tabbed-section-2')[0].classList.remove('visible');
                document.querySelectorAll('.tabbed-section-2')[0].classList.add('hidden');
                document.querySelectorAll('.tabbed-section-3')[0].classList.remove('visible');
                document.querySelectorAll('.tabbed-section-3')[0].classList.add('hidden');
            }

            if (this.classList.contains('tabbed-section__selector-tab-2')) {
                // and change the classes, show the second content panel
                document.querySelectorAll('.tabbed-section-2')[0].classList.remove('hidden');
                document.querySelectorAll('.tabbed-section-2')[0].classList.add('visible');
                // Hide the first
                document.querySelectorAll('.tabbed-section-1')[0].classList.remove('visible');
                document.querySelectorAll('.tabbed-section-1')[0].classList.add('hidden');
                document.querySelectorAll('.tabbed-section-3')[0].classList.remove('visible');
                document.querySelectorAll('.tabbed-section-3')[0].classList.add('hidden');
            }

            if (this.classList.contains('tabbed-section__selector-tab-3')) {
                // and change the classes, show the second content panel
                document.querySelectorAll('.tabbed-section-3')[0].classList.remove('hidden');
                document.querySelectorAll('.tabbed-section-3')[0].classList.add('visible');
                // Hide the first
                document.querySelectorAll('.tabbed-section-1')[0].classList.remove('visible');
                document.querySelectorAll('.tabbed-section-1')[0].classList.add('hidden');
                document.querySelectorAll('.tabbed-section-2')[0].classList.remove('visible');
                document.querySelectorAll('.tabbed-section-2')[0].classList.add('hidden');
            }
        });
    };

    // Then finally, iterates through all tabs, to activate the 
    // tabs system.
    for (var i = tabs.length - 1; i >= 0; i--) {
        toggleTab(tabs[i]);
    }
    /* tabbed material panel end */

    //load settings into the inputs
    try {
        db.settings
            .where('key')
            .equals("email")
            .toArray().then(emailSettings => {
                if (emailSettings == null) {
                    return;
                }

                document.querySelector("#emailGAPIClientID").value = emailSettings[0].value.GAPIid;
                document.querySelector("#emailGAPIClientKey").value = emailSettings[0].value.GAPIkey;
                document.querySelector("#emailHost").value = emailSettings[0].value.Host;
                document.querySelector("#emailUsername").value = emailSettings[0].value.Username;
                document.querySelector("#emailPassword").value = emailSettings[0].value.Password;
                document.querySelector("#emailFrom").value = emailSettings[0].value.From;
                document.querySelector("#emailTo").value = emailSettings[0].value.To;
                document.querySelector("#emailSubject").value = emailSettings[0].value.Subject;
                document.querySelector("#emailBody").value = emailSettings[0].value.Body;
                document.querySelector("#emailSecureToken").value = emailSettings[0].value.SecureToken;
                shouldSendEmail = emailSettings[0].value.SendEmail;
                useEmailSecureToken = emailSettings[0].value.UseSecureToken;
                document.querySelector("#sendEmailCheckbox").checked = shouldSendEmail;
                document.querySelector("#useSecureTokenCheckbox").checked = useEmailSecureToken;
                //Setup disabled/enabled inputs
                useTokenCheckboxClicked();
                return;
            });
    } catch (error) {
        console.log("displayTabbedOptions -> error", error);
    }
}


//Load client gapi before anything as it takes some time to load.
gapi.load('client:auth2');
let gapiInterval = setInterval(() => {
    //wait for the gapi to load
    if (gapi.auth2) {
        clearInterval(gapiInterval);
        //Run the regular startup.
        startup();
    }
}, 50);
//startup();
