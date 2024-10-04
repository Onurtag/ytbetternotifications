// ==UserScript==
// @name            YtBetterNotifications (Alpha)
// @namespace       Yt.Better.Notifications
// @version         1.1.29
// @description     A new youtube desktop notifications panel with extra functionality.
// @author          Onurtag
// @match           https://www.youtube.com/new*
// @match           https://www.youtube.com/reporthistory*
// @grant           none
// @require         https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment-with-locales.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/dexie/3.2.6/dexie.min.js
// @require         https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @require         https://cdn.jsdelivr.net/npm/dexie-export-import@4.1.1/dist/dexie-export-import.min.js
// @require         https://cdn.jsdelivr.net/npm/js-base64@3.7.7/base64.min.js
// @run-at          document-idle
// ==/UserScript==

let db,
    selectedfile,
    currentPage = 0,
    buttonElement = null,
    shouldSendEmail = false,
    emailGAPIReady = false,
    GAPIClientID = null,
    GAPIClientKey = null,
    useEmailSecureToken = false,
    useRelativeTime = false,
    useDailyLargeCheck = false,
    largeCheck = false,
    filterString = "",
    maxPages = 99999;

const MAX_LOG_SIZE = 600,
    LOG_PURGE_AMOUNT = 100;

ytbnDebugEmail = false;
console.time("YTBN");
console.log("🚀 YTBN ~ ", { ytbnDebugEmail });

let dontSendEmailsOver = 150;
let itemsPerPage = 50;
let liveTitlePrependString = "🔴 ";

const regexVideoURLtoID = /(.*?(watch.v=|watch_videos.video_ids=)(.*?)($|,.*$))/;
const regexImageURLtoID = /https?:\/\/i.ytimg.com\/(vi|vi_webp)\/(.*?)\/.*?.(jpg|webp)/;

/*
TODO: Increment Version Number
TODO: (optionally) Get more data while saving notifications (instead of doing it before sending emails.) Needs to be batched to prevent throttling.

LATER: Link channel image to channel if I have the data
LATER: Add a "Saved!" popup when you click save
LATER: switch moment.js with a better library (or native)
LATER: Constrict selector queries (use node.querySelector instead of document.querySelector etc...)
LATER MAYBE: Email error log window with a table
LATER MAYBE: Switch to a build setup (separate js, css, html files) BUT; for now I don't need it as I use Template Literal Editor.

--other info--
1. alternative youtube library: https://github.com/LuanRT/YouTube.js
    + node.js
    + has notifications
    + cookies or oauth
    !!!: main account might get in trouble (etc.)
----

*/

//Play silent audio to prevent background tab throttling
//This might require "autoplay" to be turned on for the website
//original source: https://github.com/t-mullen/silent-audio/blob/master/src/index.js
class SilentAudio {
    constructor() {
        this.ctx = new AudioContext();
        this.source = this.ctx.createConstantSource();
        this.gainNode = this.ctx.createGain();

        this.gainNode.gain.value = 0.001; // required to prevent popping on start
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        //suspend context and start the source
        this.ctx.suspend();
        this.source.start();
    }
    play() {
        this.ctx.resume();
    }
    pause() {
        this.ctx.suspend();
    }
}
let silentAudio = new SilentAudio();
silentAudio.play();

/* Restore fetch for our context (because the website hijacks it) */
const ifr = document.createElement('iframe');
ifr.style.display = 'none';
document.body.appendChild(ifr);
const fetch = ifr.contentWindow.fetch;    //only for our context (not window.fetch)

function startup() {
    let startInterval = setInterval(async () => {
        //wait for the notification button to appear (first load)
        buttonElement = document.querySelector("[class*='notification-topbar-button'] > button") ||
            document.querySelector("div#button.ytd-notification-topbar-button-renderer") ||
            document.querySelector(".ytd-notification-topbar-button-shape-renderer #button.yt-icon-button");
        if (buttonElement == null) {
            return;
        }
        clearInterval(startInterval);

        //set moment.js locale
        moment.locale(document.querySelector("html").lang);

        //Setup dexie db
        await setupDB();
        //read settings from the database
        await readSettings();

        //Setup the notifications div (with the "loading..." spinner)
        addStyles();
        setupNotificationDiv();
        //Check if there are any existing failure logs (and update the button)
        await checkErrorLogs();

        //Enable the smaller notifications panel css which loads notifications faster
        document.querySelector("#smallernotpanel").disabled = false;
        //Open notifications panel for scrolling
        buttonElement.click();

        let waiting = 0;
        let startInterval2 = setInterval(() => {
            //Wait for the GAPI if we are using it.
            if (shouldSendEmail == false || GAPIClientID == null || emailGAPIReady == true || waiting > 5000) {

                //Wait for any notification element to appear
                if (document.querySelector('ytd-notification-renderer') != null) {
                    clearInterval(startInterval2);

                    //default scroll settings
                    let scrolls = 2;
                    let scrollInterval = 155;
                    largeCheck = false;

                    if (useDailyLargeCheck) {
                        let storedTime = parseInt(localStorage.getItem("ytbnLastLargeCheck")) || 0;
                        let nowTime = Date.now();
                        //86400000 = 1 day
                        if (!storedTime || nowTime > storedTime + 86000000) {
                            //daily long scroll settings
                            scrolls = 3;
                            scrollInterval = 195;
                            largeCheck = true;
                        }
                    }

                    scrollNotifications(scrolls, scrollInterval);


                }
            }
            //LATER: this might not work correctly if the tab is throttled. Probably a better idea to use Now() etc.
            waiting += 100;
        }, 100);
        return;

    }, 100);
}

function scrollNotifications(scrolltimes = 1, interval = 155) {

    cleanLogsOverQuota();

    //Play silent audio
    silentAudio.play();

    let scrollcount = 0,
        nullcount = 0,
        fixCount = 0,
        toBeFixed = 0,
        maxnullcount = 34, //Minimum 4. Increase this if you have a small interval timer
        finalAmount = -1,
        startedChecking = false;
    let prev_lastNode;

    let scrollInterval = setInterval(() => {
        //verify and correct scroll count
        let notificationcount = document.querySelectorAll("ytd-notification-renderer").length;
        if (scrollcount != notificationcount / 20) {
            scrollcount = notificationcount / 20;
        }
        if (!startedChecking && (scrollcount <= scrolltimes) && (nullcount <= maxnullcount)) {
            try {
                //document.querySelector('[menu-style="multi-page-menu-style-type-notifications"] ytd-continuation-item-renderer').scrollIntoView();
                let lastNode = document.querySelector("ytd-notification-renderer:last-of-type");
                if (lastNode == prev_lastNode) {
                    nullcount++;
                    if (nullcount % 2 == 0) {
                        //Scroll up and down to trigger loading again
                        document.querySelector("ytd-notification-renderer:first-of-type").scrollIntoView();
                    }
                } else {
                    //reset nullcount whenever we successfully do a scroll
                    nullcount = 0;
                    prev_lastNode = lastNode;
                }
                lastNode.scrollIntoView();
                scrollcount++;  //cosmetic
            } catch (error) {
                console.log("🚀 YTBN ~ scrolling error:", { error });
            }
        } else {
            //---FORWARD Scrolling finished---
            //---FORWARD Scrolling finished---
            //---FORWARD Scrolling finished---
            startedChecking = true;
            // console.log("🚀 YTBN ~ attempting to fix:", fixCount++);
            //Scroll lazy nodes to wake them up (load lazy loaded images & urls)
            let loadedNotifs = document.querySelectorAll("ytd-notification-renderer");
            if (finalAmount == -1) {
                finalAmount = loadedNotifs.length;
            }
            // loadedNotifs.slice(0, finalAmount); //requires [...blabla]
            let count = 0;
            toBeFixed = 0;
            for (let index = 0; index < finalAmount; index++) {
                const element = loadedNotifs[index];
                if (element.querySelector("img[src]")) {
                    count++;
                } else {
                    // console.log("🚀 YTBN ~ attempting to fix:", element.innerText, index);
                    element.scrollIntoView();
                    toBeFixed++;
                }
            }
            fixCount++;
            if (count == finalAmount) {
                //---ALL Scrolling finished---
                //---ALL Scrolling finished---
                //---ALL Scrolling finished---
                console.log("🚀 YTBN ~ All good. Notification count & fix count:", count, fixCount);
                //Stop interval
                clearInterval(scrollInterval);
                //Continue the rest of the loading process
                continuing(count);
            }
        }
        console.log("🚀 YTBN ~ scrollInterval ~ notificationcount:", notificationcount, "nullcount:", nullcount, "toBeFixed:", toBeFixed);
    }, interval);
}

//LATER convert to async
function continuing(nC) {

    //Async update the notifications database
    saveNotifications(nC).then(result => {

        //Close notifications panel
        buttonElement.click();
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

        if (largeCheck) {
            localStorage.setItem("ytbnLastLargeCheck", Date.now());
        }
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
        saveAs(blob, "ytbetternotifications-export-" + Date.now().toString().slice(0, -8) + "00000000" + ".json");
    } catch (error) {
        console.error('🚀 YTBN ~ File export error: ', error);
    }
}

function fileInputOnchange(event) {
    let files = event.target?.files || event.target?.$?.nativeInput?.files || null;
    if (files) {
        selectedfile = files[0];
    }
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

        console.log("🚀 YTBN ~ Importing file: ", file.name);
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
        console.log("🚀 YTBN ~ Import complete.");
        return;
    } catch (error) {
        console.error('🚀 YTBN ~ File import error: ', { error });
    }
}

function progressCallback({
    totalRows,
    completedRows
}) {
    console.log(`🚀 YTBN ~ Export/Import Progress: ${completedRows} of ${totalRows} rows completed.`);
}

async function setupDB() {
    db = new Dexie("NotificationsDatabase");

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

    await db.open().catch(function (err) {
        console.error("🚀 YTBN open", err.stack || err);
    });

    //db.delete();
}

function filterPage() {
    //set filter string, should be blank "" by default
    filterString = document.querySelector("#sidebuttonsTop #sidebarFilterInput").value;
    // Reload notifications
    // cleanTable(false);
    loadNotifications(0, true).then(function (result) {
        console.log("🚀 ~ filterPage result:", { result });
        if (result != 0) {
            setupPaginationButtons();
        }
        return result;
    });
}

function previousPage(event) {
    if (currentPage == 0) {
        return;
    }
    // cleanTable(false);
    loadNotifications(currentPage - 1, true).then(function (result) {
        --currentPage;
        setupPaginationButtons();
        return result;
    });
}

function nextPage(event) {
    if (currentPage == maxPages - 1) {
        return;
    }
    // cleanTable(false);
    loadNotifications(currentPage + 1, true).then(function (result) {
        ++currentPage;
        setupPaginationButtons();
        return result;
    });

}

function firstPage(event) {
    if (currentPage == 0) {
        return;
    }
    // cleanTable(false);
    loadNotifications(0, true).then(function (result) {
        currentPage = 0;
        setupPaginationButtons();
        return result;
    });
}

function lastPage(event) {
    if (currentPage == maxPages - 1) {
        return;
    }
    // cleanTable(false);
    loadNotifications(maxPages - 1, true).then(function (result) {
        currentPage = maxPages - 1;
        setupPaginationButtons();
        return result;
    });
}

function discardLogs(event) {
    var r = confirm("Are you sure you want to discard all logs?");
    if (r != true) {
        return;
    }
    db.logs.clear();
    //setupdb is not needed
    setupDB();
}

function discardNotifications(event) {
    var r = confirm("Are you sure you want to clear the notification database?");
    if (r != true) {
        return;
    }
    cleanTable();
    db.notifications.clear();
    //setupdb is not needed
    setupDB();
}

function discardSettings(event) {
    var r = confirm("Are you sure you want to clear all settings?");
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
        document.querySelector("#outerNotifications tp-yt-paper-spinner").setAttribute("active", "");
        document.querySelector("#loadindicator").hidden = false;
    } else {
        //Disable the spinner
        document.querySelector("#outerNotifications tp-yt-paper-spinner").removeAttribute("active");
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
    buttonElement.click();
    scrollNotifications(6666);
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

function cleanTable(removeButtons = true) {
    if (removeButtons) {
        document.querySelector("#innerNotifications").innerHTML = "";
    } else {
        document.querySelector("#innerNotifications").innerHTML = document.querySelector("#innerNotifications > #pagingButtonsOuter").outerHTML;
    }
}

async function saveNotifications(nC) {

    //let nodeArray = Array.from(document.querySelectorAll("ytd-notification-renderer"));
    //Re-parse the notifications container node to work on it. Usual methods like .children, .firstElementChild are set to null on youtube's custom nodes.
    let parser = new DOMParser();
    let container = parser.parseFromString(document.querySelector("ytd-notification-renderer").parentElement.outerHTML, 'text/html');
    container = container.body.firstElementChild;
    let nodeArray = [...container.querySelectorAll("ytd-notification-renderer")];
    nodeArray = nodeArray.slice(0, nC);

    let newCount = 0;
    let emailDictArray = [];
    let promiseResults = await Promise.all(nodeArray.map(async (element) => {

        let notVideo = false;
        let rowUrl = element.querySelector('[role="link"]')?.href;
        if (rowUrl.includes("&pp=")) {
            rowUrl = rowUrl.replace(/&pp=.*/, "")
        }

        //if the notification thumbnail images aren't there, skip.
        let userImg = element.querySelectorAll("img")[0]?.src || "";
        // if (!userImg) {
        //     return "userimagedidnotload";
        // }

        let videoImage = element.querySelectorAll("img")[1]?.src || "";
        // if (!videoImage) {
        //     return "videoimagedidnotload";
        // }

        if (rowUrl == "" && videoImage) {
            //if the notification is not a video link, mark as notvideo (comment)
            //and instead parse the video url from the videoimgurl
            notVideo = true;
            let matchingID = videoImage.match(regexImageURLtoID)[2];
            rowUrl = 'https://www.youtube.com/watch?v=' + matchingID;
        }
        const strings = element.querySelectorAll("yt-formatted-string");

        let currDict = {
            id: uuidv4(),
            hash: "",
            url: rowUrl,
            title: strings[0]?.innerText,
            time: reversefromNow(strings[2]?.innerText),
            userimgurl: userImg,
            videoimgurl: videoImage,
            live: false,
            read: false,
            notvideo: notVideo,
        };

        //detect duplications
        //concenate "url + userimgurl + title/comment" strings and hash the result. This will be used to prevent saving duplicate notifications.
        //LATER MAYBE: remove userimgurl from the hash (warning!)
        currDict.hash = await digestToSHA256(currDict.url + currDict.userimgurl + currDict.title);

        //duplicate check using hash
        const count = await db.notifications
            .where('hash')
            .equals(currDict.hash)
            .count().then(function (count) {
                return count;
            });
        //the notification already exists so skip it.
        if (count > 0) {
            return "alreadyexists";
        }

        console.log("🚀 YTBN ~ saveNotifications -> currDict", { currDict });

        //detect livestreams
        if (currDict.title.includes(" is live: ")) {
            currDict.live = true;
            //set livestreams as read automatically
            currDict.read = true;
        }

        //put the notification into the database
        const dbput = await db.notifications.put(currDict);

        if (shouldSendEmail) {

            //Log with Email_Send_Failure type. The log will be updated later.
            let logDict = {
                type: "Email_Send_Failure",
                time: moment().format("YYYY-MM-DD HH:mm:SSS"),
                extra: {
                    notifData: currDict
                },
                log: "YTBN Status: Email_After_dbput",
            };
            const log_number = await db.logs.put(logDict);
            //Keep the log number with the notification data
            currDict.log_number = log_number;

            //We are done here, but; currDict gets modified so duplicate it.
            emailDictArray.push(JSON.parse(JSON.stringify(currDict)));
        }

        newCount++;

        return dbput;
    }));

    console.log("🚀 YTBN ~ saveNotifications ~ promiseResults:", { promiseResults });

    //get db size and set max pages
    const itemcount = await db.notifications
        .count().then(function (count) {
            return count;
        });
    maxPages = Math.ceil(itemcount / itemsPerPage);

    console.log("🚀 YTBN ~ " + newCount + " new notifications were saved into the db.");
    console.timeEnd("YTBN");

    //send all emails
    if (emailDictArray.length > 0) {
        sendEmailBatch(emailDictArray);
    }
}

async function loadNotifications(page = 0, clearNotifs = false) {
    try {
        let filteredCollection = null;
        if (filterString == "") {
            //NO Filter (everything)
            filteredCollection = await db.notifications
                .orderBy('time')
                .reverse();
        } else {
            //YES Filter
            const filterregex = new RegExp(filterString, 'i');
            filteredCollection = await db.notifications
                .orderBy('time')
                .reverse()
                .filter((notification) => {
                    return filterregex.test(notification.title);
                });
        }

        //Set max pages
        const itemcount = await filteredCollection
            .count().then(function (count) {
                return count;
            });
        maxPages = Math.ceil(itemcount / itemsPerPage);

        if (itemcount == 0) {
            document.querySelector("#outerNotifications #innerNotifications").classList.add("empty");
            //stop here
            return itemcount;
        } else {
            document.querySelector("#outerNotifications #innerNotifications").classList.remove("empty");
        }

        //Get current page
        let notificationsArray = await filteredCollection
            .offset(page * itemsPerPage)
            .limit(itemsPerPage)
            .toArray()
            .then(function (result) {
                return result;
            });

        if (clearNotifs) {
            cleanTable(false);
        }

        notificationsArray.forEach(dict => {
            displayNotification(dict);
        });

        // console.log("🚀 ~ loadNotifications ~ itemcount:", itemcount);
        return itemcount;
    } catch (error) {
        console.error("🚀 YTBN ~ loadNotifications ~ error:", error);
    }
}

function displayNotification(currDict) {

    //display notifications also send the dictionary to save as well.

    const dummyHTML = `
    <div data-id="DUMMYDATASETID" class="notificationsRow">
        <div class="notifRowItem notcol1">ROWDUMMYROW1</div>
        <div class="notifRowItem notcol2">ROWDUMMYROW2</div>
        <div class="notifRowItem notcol3">ROWDUMMYROW3</div>
        <div class="notifRowItem notcol4">ROWDUMMYROW4</div>
        <div class="notifRowItem notcol5">
            <tp-yt-paper-checkbox noink READCHECKED>Read</tp-yt-paper-checkbox>
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
    if (useRelativeTime) {
        col3 = moment(currDict.time).fromNow();
    } else {
        col3 = moment(currDict.time).format('lll');
    }

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
    document.querySelector(".notificationsRow:last-of-type tp-yt-paper-checkbox").addEventListener('click', checkboxReadClicked);
}

async function togglereadAll(event) {
    let theCheckbox = event.target.closest("tp-yt-paper-checkbox");

    var r = confirm("Are you sure? This can not be undone! (unless you export your notifications)");
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
    }).catch(Dexie.ModifyError, function (e) {
        console.error("🚀 YTBN ~ failed to modify read value", e.failures.length);
        throw e;
    });

    document.querySelectorAll(".notificationsRow").forEach(element => {
        if (readvalue) {
            element.classList.add("notificationRead");
        } else {
            element.classList.remove("notificationRead");
        }
        element.querySelector("tp-yt-paper-checkbox").checked = readvalue;
    });
    return;
}

async function checkboxReadClicked(event) {

    let eventRow = event.target.closest("div.notificationsRow");
    let rowId = eventRow.dataset.id;

    if (rowId == "" || !rowId) {
        console.log("🚀 YTBN ~ Error while reading row ID", { rowId });
        return "Error while reading row ID";
    }

    let readvalue;
    if (eventRow.querySelector("tp-yt-paper-checkbox").checked == true) {
        readvalue = true;
    } else {
        readvalue = false;
    }

    return await db.notifications.where("id").equals(rowId).modify({
        "read": readvalue
    }).then(result => {
        const notifCol2 = eventRow.querySelector(".notcol2");
        const notifTitle = notifCol2?.textContent;
        const notifVidURL = notifCol2?.firstElementChild?.href;
        if (readvalue) {
            eventRow.classList.add("notificationRead");
        } else {
            eventRow.classList.remove("notificationRead");
        }
        console.log(`🚀 YTBN ~ Notification set as ${readvalue ? "Read" : "Unread"}:`, { notifTitle }, { notifVidURL }, { rowId });
        return result;
    }).catch(Dexie.ModifyError, function (e) {
        console.error("🚀 YTBN ~ failed to modify read value", e.failures.length);
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
        if (input.includes(value.replace("%s", ""))) {
            pastfuture = key;
        }
    }

    //detect the time unit
    let unitkey;
    for (const [key, value] of Object.entries(relativeLocale)) {
        if (input.includes(value.replace("%d", ""))) {
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
        height: 82%;
        border-radius: 15px;
        z-index: 2201;
        top: 50%;
        left: 50%;
        /*transform: translate(-50%, -50%);*/
        transform: translateX(calc(-50% - 0.5px)) translateY(calc(-50% - 0.5px));
        color: #ddd;
        box-shadow: 0 4px 4px rgba(0, 0, 0, 0.4), 0 -2px 4px rgba(0, 0, 0, 0.4), -2px 0 4px rgba(0, 0, 0, 0.4), 4px 0 4px rgba(0, 0, 0, 0.4);
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
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.3);
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

    #filterClearButton:hover {
        background: #47474787;
        filter: brightness(120%);
    }

    #filterClearButton {
        border: 1px solid transparent;
        border-radius: 50%;
        font-size: 10pt;
        position: relative;
        width: 26px;
        height: 22px;
        margin: auto -7px auto auto;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    /* Message for when there are no notifications */
    #innerNotifications.empty:empty:before {
        content: "No notifications were found.\\a Suggestion: Clear the filter.";
        font-size: 18pt;
        text-align: center;
        white-space: pre-line;
        margin-block: auto;
    }

    #innerNotifications {
        display: flex;
        flex-direction: column;
        overflow: auto;
        height: 90%;
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
        margin-right: 2%;
        margin-bottom: 4px;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-content: center;
        align-items: center;
        font-size: 1.5em;
        /* below are for the css transitions */
        transition: margin, transform, opacity, max-height, visibility;
        transition-duration: 170ms;
        max-height: 128px;
        overflow: clip;
    }

    /* same as .notificationsRow */

    #pagingButtons {
        margin-left: 3%;
        margin-right: 4%;
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
    .notcol1,
    .notcol4 {
        height: 120px;
        align-items: center;
        text-align: center;
    }

    .notcol1 {
        flex-grow: 0.9;
        margin-left: 0px;
    }

    .notcol2 {
        flex-grow: 3;
    }

    .notcol3 {
        text-align: center;
        flex-grow: .8;
        margin-left: 6px;
    }

    .notcol4 {
        flex-grow: 1;
    }

    .notcol5 {
        flex-grow: 0.5;
        margin-right: 0px;
    }

    .notifRowItem img,
    .notifRowItem > a.nvimgc {
        width: 100%;
        height: 100%;
        object-fit: scale-down;
    }

    #sidebuttons tp-yt-paper-checkbox {
        min-height: 25px;
        margin-bottom: 0.5em;
    }

    #outerNotifications tp-yt-paper-checkbox:not([checked]) #checkbox {
        border-color: #ccc;
    }

    #outerNotifications tp-yt-paper-checkbox[checked]:hover #checkbox {
        opacity: 0.8;
    }

    #outerNotifications tp-yt-paper-checkbox:not([checked]):hover #checkbox {
        border-color: #72a6d7 !important;
    }

    #outerNotifications tp-yt-paper-checkbox {
        font-size: .85em;
        margin-left: 14px;
        width: fit-content;
    }

    #outerNotifications .notificationsRow tp-yt-paper-checkbox {
        margin: 0px;
        padding: 10px;
        background: #222;
        border-radius: 8px;
    }

    #outerNotifications .notificationsRow tp-yt-paper-checkbox:hover {
        background: #2b2b2b;
        filter: contrast(90%);
    }

    #outerNotifications tp-yt-paper-checkbox #checkboxLabel {
        color: #ddd;
        /*width: 66%;*/
        padding-left: 10px;
    }

    #sidebuttons paper-ripple {
        color: rgba(0, 0, 0, 0);
    }

    #sidebuttonsTop #filterContainer {
        display: flex;
        flex-direction: row;
        border: 2px #3EA6FF44 solid;
        border-radius: 8px;
        margin: 0px 8px 12px 8px;
        padding: 0px 10px;
        transition: all 200ms;
        width: 100px;
    }

    /* Enlarge and glow when focused inside (for ease of use) */
    #sidebuttonsTop #filterContainer:focus-within {
        width: 500px;
        background: #151515;
        border: 2px #0089FF solid;
        box-shadow: 0px 0px 8px #59B2FFB2;
        z-index: 1;
    }

    /* status (default is error) */
    .ytb-status {
        border: 1px #f03737f2 solid;
        font-size: .8em;
        text-align: center;
        margin: 12px 12px 1em 12px;
        border-radius: 3px;
        padding: 6px;
        color: #ff6f6f;
    }

    .ytb-status-hidden {
        visibility: hidden;
    }`;
    document.head.append(newstyle);

    //POPUP options css
    newstyle = document.createElement("style");
    newstyle.id = "tabbedoptionscss";
    newstyle.innerHTML = `
    .hideSMTPJS {
        display: none;
    }

    #backgroundOverlay {
        position: fixed;
        width: 200vw;
        height: 200vh;
        top: -100%;
        left: -100%;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
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
        border: 2px rgb(62, 62, 62) solid;
        display: block;
        width: 50%;
        height: 101%;
        border-radius: 15px;
        --paper-tabs-selection-bar-color: var(--paper-blue-a200);
    }

    #notificationOptions > iron-pages {
        margin: 0px 16px 16px 16px;
    }

    #notificationOptions tp-yt-paper-button {
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

    .tabbed-section__selector-tab-3.active ~ .tabbed-section__highlighter {
        transform: translateX(200%);
    }

    .tabbed-section__selector-tab-2.active ~ .tabbed-section__highlighter {
        transform: translateX(100%);
    }

    .tabbed-section__selector-tab-1.active ~ .tabbed-section__highlighter {
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

    .button_error {
        border: 1px #f009 solid;
        filter: drop-shadow(0px 0px 4px #ff3e3e);
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
        /* display: none; */
        max-height: 0px;
        opacity: 0;
        visibility: hidden;
        margin-block: 0;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#hidelivecss").disabled = true;

    //hide read notifications css
    newstyle = document.createElement("style");
    newstyle.id = "hidereadcss";
    newstyle.innerHTML = `
    .notificationRead {
        /* display: none; */
        max-height: 0px;
        opacity: 0;
        visibility: hidden;
        margin-block: 0;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#hidereadcss").disabled = true;

    //hide comments css
    newstyle = document.createElement("style");
    newstyle.id = "hiderepliescss";
    newstyle.innerHTML = `
    .notificationComment {
        /* display: none; */
        max-height: 0px;
        opacity: 0;
        visibility: hidden;
        margin-block: 0;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#hiderepliescss").disabled = true;

    //smaller notifications panel css
    newstyle = document.createElement("style");
    newstyle.id = "smallernotpanel";
    newstyle.innerHTML = `
    ytd-notification-renderer {
        height: 4px !important;
        padding: 3px 6px !important;
    }

    /*notifications panel opacity*/
    tp-yt-iron-dropdown {
        /*z-index: -1 !important;*/
        opacity: 75%;
    }
    `;
    document.head.append(newstyle);
    document.querySelector("#smallernotpanel").disabled = true;


}

/* jshint ignore:start */
/* beautify ignore:start */
/* prettier-ignore */

/* SmtpJS from https://smtpjs.com/v3/smtp.js start */
/* SmtpJS.com - v3.0.0 */
var Email = { send: function (a) { return new Promise(function (n, e) { a.nocache = Math.floor(1e6 * Math.random() + 1), a.Action = "Send"; var t = JSON.stringify(a); Email.ajaxPost("https://smtpjs.com/v3/smtpjs.aspx?", t, function (e) { n(e) }) }) }, ajaxPost: function (e, n, t) { var a = Email.createCORSRequest("POST", e); a.setRequestHeader("Content-type", "application/x-www-form-urlencoded"), a.onload = function () { var e = a.responseText; null != t && t(e) }, a.send(n) }, ajax: function (e, n) { var t = Email.createCORSRequest("GET", e); t.onload = function () { var e = t.responseText; null != n && n(e) }, t.send() }, createCORSRequest: function (e, n) { var t = new XMLHttpRequest; return "withCredentials" in t ? t.open(e, n, !0) : "undefined" != typeof XDomainRequest ? (t = new XDomainRequest).open(e, n) : t = null, t } };
/* SmtpJS end */

/* jshint ignore:end */
/* beautify ignore:end */
/* prettier-ignore-end */

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
        log_number: "disabled"
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
        log_number: "disabled"
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
        log_number: "disabled"
    };
    videoDictArray.push(testDict);

    console.log("🚀 YTBN ~ testEmail -> videoDictArray", { videoDictArray });

    const sendingemail = sendEmailBatch(videoDictArray).then(function (result) {
        console.log("🚀 YTBN ~ TEST EMAILS SENT.");
        return result;
    });
}

async function cleanLogsOverQuota() {
    let logSize = await db.logs
        .count();

    //Check if the amount of logs are over the quota
    if (logSize >= (MAX_LOG_SIZE + LOG_PURGE_AMOUNT)) {
        //Delete the first xxx logs
        let purgedLogs = await db.logs
            .orderBy("number")
            .offset(0).limit(LOG_PURGE_AMOUNT)
            .delete();
        console.log("🚀 YTBN ~ cleanLogsOverQuota ~ Purged logs over quota - ", { purgedLogs });
        return;
    } else {
        return;
    }

}

async function sendEmailBatch(videoDictArray) {

    if (videoDictArray.length > dontSendEmailsOver) {
        console.error(`🚀 YTBN ~ You have over ${dontSendEmailsOver} new videos. The action of sending emails was cancelled.`);
        return;
    }
    if (videoDictArray.length == 0) {
        return;
    }

    //Purge some email logs if we have too many.
    cleanLogsOverQuota();

    //handle multiple urls, replies/comments
    let emailSendArray = [];
    for (let i = 0; i < videoDictArray.length; i++) {

        //---handle Url types---

        if (videoDictArray[i].url.includes("video_ids")) {
            //handle https://www.youtube.com/watch_videos?video_ids=SZ_q3EC-YJ4,tSgrOcejiUs,skCiZ9IJmZY&type=0&title=幽閉サテライト&少女フラクタル+公式チャンネル
            try {
                let matchedIDs = videoDictArray[i].url.match(/video_ids=(.*?)(&|$)/)[1];
                matchedIDs = matchedIDs.split(",");

                for (let j = 0; j < matchedIDs.length; j++) {
                    const videoID = matchedIDs[j];
                    let cloneDict = JSON.parse(JSON.stringify(videoDictArray[i]));
                    cloneDict.url = 'https://www.youtube.com/watch?v=' + videoID;
                    emailSendArray.push(cloneDict);
                }
            } catch (error) {
                console.error(`🚀 YTBN ~ EmailSendError: The data doesn't include a video url.`, videoDictArray[i]);
            }

        } else {
            //Don't handle regular urls & others if they exist
            // https://www.youtube.com/watch?v=BorBtFVvzbk
            emailSendArray.push(videoDictArray[i]);
        }
    }

    console.log("🚀 YTBN ~ sendEmailBatch -> emailSendArray", { emailSendArray });

    //Email batch size. Keeping this small should help prevent sent emails from being detected as spam.
    let emailBatchSize = 3;
    for (let i = 0; i < emailSendArray.length; i += emailBatchSize) {

        //Send single email
        const emailBatch = emailSendArray.slice(i, i + emailBatchSize).map(async (videoDict) => {
            try {
                return sendEmail(videoDict);
            } catch (e) {
                console.log(`🚀 YTBN ~ Error in sending email for`, { videoDict }, { e });
            }
        });

        await Promise.all(emailBatch)
            .catch(e => {
                console.log(`🚀 YTBN ~ Error in sending email for the batch`, { i }, { e });
            });

    }

    console.log(`🚀 YTBN ~ Finished sending email batch.`);
    //check for error logs after all emails were attempted to send
    await checkErrorLogs();

}

async function sendEmail(videoDict) {

    //no need to clone videoDict

    // console.log("🚀 YTBN ~ sendEmail -> videoDict", videoDict, Date.now());

    let channelName = "",
        channelURL = "",
        vidLength = "";

    //Use fetch to get the video data
    //This can be seperated into its own function if needed.
    await fetch(videoDict.url).then(function (response) {
        return response.text();
    }).then(function (newhtml) {
        //LATER these don't have to be inside .then blocks. Just use await.

        //expose raw html for debugging purposes
        emailhtml = newhtml;
        // Convert the HTML string into a document object
        var parser = new DOMParser();

        let emaildoc = parser.parseFromString(newhtml, 'text/html');

        let ytInitialData_PARSED, ytInitialPlayerResponse_PARSED;
        for (let scriptindex = 0; scriptindex < emaildoc.scripts.length; scriptindex++) {
            const thescript = emaildoc.scripts[scriptindex];
            //LATER: Could use eval() or parse()

            //combined OLD method
            if (thescript.innerHTML.includes('window["ytInitialData"]')) {
                // Also thescript.innerHTML.match(/window\[\"ytInitialData\"\] = (.*);\n\s*window\[\"ytInitialPlayerResponse/)[1];
                ytInitialData_PARSED = JSON.parse(thescript.innerHTML.split("window[\"ytInitialData\"] = ")[1].split("ytInitialPlayerResponse")[0].split(";\n")[0]);
                // Also ...
                ytInitialPlayerResponse_PARSED = JSON.parse(thescript.innerHTML.split("window[\"ytInitialPlayerResponse\"] = ")[1].split("window.ytcsi")[0].split(";\n")[0]);
            }

            //YTinitialdata NEW method
            if (thescript.innerHTML.includes('var ytInitialData = ')) {
                // Also thescript.innerHTML.match(/window\[\"ytInitialData\"\] = (.*);\n\s*window\[\"ytInitialPlayerResponse/)[1];
                ytInitialData_PARSED = JSON.parse(thescript.innerHTML.split("var ytInitialData = ")[1].slice(0, -1));

            }

            //ytInitialPlayerResponse NEW method
            if (thescript.innerHTML.includes('var ytInitialPlayerResponse = ')) {
                ytInitialPlayerResponse_PARSED = JSON.parse(thescript.innerHTML.split("var ytInitialPlayerResponse = ")[1].split(";var meta = document.createElement('meta')")[0]);

            }


        }

        //Get the best possible values from the fetched page.
        //Might be useless to double check but they can stay just in case.

        // Handle videoDict.title
        // DONE Comments should not change their titles.
        if (!videoDict.notvideo) {

            try {

                let newTitle = ytInitialPlayerResponse_PARSED?.videoDetails?.title ||
                    ytInitialData_PARSED?.contents?.twoColumnWatchNextResults?.results?.results?.contents[0]?.videoPrimaryInfoRenderer?.title?.runs[0]?.text ||
                    newhtml?.match(/<meta (property|name)="(og|twitter):title" content="(.*?)">/)[3];
                if (newTitle) {
                    videoDict.title = newTitle;
                }
            } catch (error) {
                console.warn("🚀 YTBN ~ videodict", error);
            }


        }

        // Handle channelName
        try {

            let newChannelName = ytInitialPlayerResponse_PARSED?.videoDetails?.author ||
                ytInitialPlayerResponse_PARSED?.microformat?.playerMicroformatRenderer?.ownerChannelName;
            if (newChannelName) {
                channelName = newChannelName;
            }
        } catch (error) {
            console.warn("🚀 YTBN ~ channelname", error);
        }

        // Handle video length
        try {

            vidLength = ytInitialPlayerResponse_PARSED?.videoDetails?.lengthSeconds ||
                ytInitialPlayerResponse_PARSED?.microformat?.playerMicroformatRenderer?.lengthSeconds;
            //format vid length from seconds
            vidLength = moment.utc(vidLength * 1000).format('HH:mm:ss').replace(/^(00:)/, "");

        } catch (error) {
            console.warn("🚀 YTBN ~ vidlength", error);
        }

        //handle userimgurl
        try {

            let newUserImgUrl = ytInitialData_PARSED?.contents?.twoColumnWatchNextResults?.results?.results?.contents[1]?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url?.replace(/=s\d.*/, "=s0") ||
                videoDict?.userimgurl;
            if (newUserImgUrl) {
                videoDict.userimgurl = newUserImgUrl;
                //Fix for example: "//yt3.ggpht.com/ytc/AAUvwngNRbQ0wRc8flYiQfOm1FFhLB1aghNa2WJs4uOD=s0"
                if (videoDict.userimgurl.match(/^\/\/.*?=s0$/)) {
                    videoDict.userimgurl = "https:" + videoDict.userimgurl;
                }
            }
        } catch (error) {
            console.warn("🚀 YTBN ~ userimg", error);
        }

        //handle videoDict.videoimgurl
        try {

            let newVideoImgUrl = ytInitialPlayerResponse_PARSED?.videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]?.url || ytInitialPlayerResponse_PARSED?.microformat?.playerMicroformatRenderer?.thumbnail?.thumbnails[0]?.url ||
                videoDict?.videoimgurl;
            if (newVideoImgUrl) {
                videoDict.videoimgurl = newVideoImgUrl;
            }
        } catch (error) {
            console.warn("🚀 YTBN ~ videoimg", error);
        }

        // Handle channel url
        try {

            channelURL = ytInitialPlayerResponse_PARSED?.microformat?.playerMicroformatRenderer?.ownerProfileUrl;
            if (channelURL == null) {
                if (ytInitialPlayerResponse_PARSED?.videoDetails?.channelId != null) {
                    channelURL = "https://www.youtube.com/channel/" + ytInitialPlayerResponse_PARSED?.videoDetails?.channelId;
                }
            }

        } catch (error) {
            console.warn("🚀 YTBN ~ channelurl", error);
        }

        return;
    }).catch(function (err) {
        // There was an error
        console.warn('🚀 YTBN ~ Something went wrong while fetching video data.', err);
    });

    const emailSettings = await db.settings
        .where('key')
        .equals("email")
        .toArray();

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

    // console.log("🚀 YTBN ~ sendEmail -> replaceThese", replaceThese);

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
    let emailSuccess = false;

    do {

        if (emailGAPIReady) {

            emailSendResponse = await emailGAPI.sendMessage(
                emailSettings[0].value.To,
                emailSettings[0].value.From,
                subjectVal,
                bodyVal
            ).then(message => {
                console.log("🚀 YTBN ~ Email.send response: ", { message });
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
                console.log("🚀 YTBN ~ Email.send response: ", { message });
                return message;
            });

        } else if (emailSettings[0].value.Password) {

            emailSendResponse = await Email.send({
                Host: emailSettings[0].value.Host,
                Username: emailSettings[0].value.Username,
                Password: emailSettings[0].value.Password,
                From: emailSettings[0].value.From,
                To: emailSettings[0].value.To,
                Subject: subjectVal,
                Body: bodyVal,
            }).then(message => {
                console.log("🚀 YTBN ~ Email.send response: ", { message });
                return message;
            });
        } else {
            console.error("❗❗❗❗❗ 🚀 YTBN ~ Email.send ERROR: ALL EMAIL SEND METHODS FAILED! Try re-authenticating gmail in options.", { message });
        }

        //Retry sending email up to 3 times
        if ((emailSendResponse != "OK") && (emailSendResponse.statusText != "OK") && (emailSendResponse.result.labelIds.includes("SENT") == false)) {
            //Email send failure. Retrying...
            console.log("🚀 YTBN ~ sendEmail -> retryEmail", { retryEmail });
            retryEmail++;
        } else {
            //Email send success.
            retryEmail = 999;
            emailSuccess = true;
        }

    } while (retryEmail <= 2);

    //Update the log of this notification with the new data
    let logDict = {
        type: "Email_Send_Failure",
        time: moment().format("YYYY-MM-DD HH:mm:SSS"),
        extra: {
            replaceThese: replaceThese,
            notifData: videoDict
        },
        log: emailSendResponse,
    };

    if (emailSuccess) {
        //Success: Email_Send_Success log type
        logDict.type = "Email_Send_Success";
    } else {
        //Failure: Email_Send_Failure log type
    }

    console.log("🚀 YTBN ~ sendEmail -> logDict", { logDict });

    //Update the log
    if (videoDict.log_number != "disabled") {
        let updated_log = await db.logs
            .where("number")
            .equals(videoDict.log_number)
            .modify(logDict)
            .catch(Dexie.ModifyError, function (e) {
                console.error("🚀 YTBN ~ failed to modify read value", e.failures.length);
                // throw e;
            });
    }

    return emailSendResponse;

    // (extras for Email.send)
    // Attachments: [{
    //     name : "smtpjs.png",
    //     path:"https://networkprogramming.files.wordpress.com/2017/11/smtpjs.png"
    // }]
}

async function readSettings() {

    try {
        //read email settings (only the ones needed)
        await db.settings
            .where('key')
            .equals("email")
            .toArray().then(emailSettings => {
                if (emailSettings == null || emailSettings.length < 1) {
                    return;
                }
                shouldSendEmail = emailSettings[0].value.SendEmail;
                useEmailSecureToken = emailSettings[0].value.UseSecureToken;
                GAPIClientID = emailSettings[0].value.GAPIid;
                GAPIClientKey = emailSettings[0].value.GAPIkey;
                return;
            });

        //read main options
        await db.settings
            .where('key')
            .equals("options")
            .toArray().then(options => {
                if (options == null || options.length < 1) {
                    return;
                }

                useRelativeTime = options[0].value.UseRelativeTime;
                useDailyLargeCheck = options[0].value?.UseDailyLargeCheck || false;
                itemsPerPage = options[0].value.itemsPerPage || itemsPerPage;
                return;
            });

        //load GAPI if they are present
        if (GAPIClientID && GAPIClientKey) {
            await emailGAPI.handleClientLoad();
        }

    } catch (error) {
        console.log("🚀 YTBN ~ readSettings error:", { error });
    }

}

/**
 * Checks for log type "Email_Send_Failure" and updates the error button accordingly
 */
async function checkErrorLogs() {

    const errored_logs = await db.logs
        .where("type")
        .equals("Email_Send_Failure")
        .toArray();

    let errButton = document.querySelector("#displayErrorListButton");
    let logLength = errored_logs.length;
    if (logLength > 0) {
        //Update error button text and class
        errButton.innerText = "ERRORS: " + logLength;
        errButton.classList.add("button_error");
    } else {
        errButton.innerText = "ERRORS: NONE";
        errButton.classList.remove("button_error");
    }
    //Return errored_logs array
    return errored_logs;
}

async function errorButtonClick() {
    let errored_logs = await checkErrorLogs();
    console.log("🚀 YTBN ~ errorButtonClick ~ errored_logs", { errored_logs });
    if (errored_logs.length > 0) {
        var r = confirm("Would you like to re-send all errored emails?");
        if (r != true) {
            return;
        }
        //Re-send errored emails using the log's notifData (which contains the log_number and the video details)
        let emailArray = [];
        errored_logs.forEach(thislog => {
            let notifData = thislog.extra.notifData;
            //Add the log_number if it doesn't exist (Email_After_dbput)
            notifData.log_number = notifData.log_number || thislog.number;
            emailArray.push(notifData);
            console.log("🚀 YTBN ~ errorButtonClick ~ notifData", { notifData });
        });
        // //only keep the first 24 emails in emailArray (for manual batching to avoid being detected as an email spammer)
        // emailArray = emailArray.slice(0, 24);
        //send all emails in emailArray
        if (emailArray.length > 0) {
            sendEmailBatch(emailArray);
        }
    }
}


function saveOptions() {
    useRelativeTime = document.querySelector("#optionRelativeTimeCheckbox").checked;
    useDailyLargeCheck = document.querySelector("#optionDailyLargeCheckbox").checked;
    let perPageElement = document.querySelector("#optionItemsPerPage input[type='number']");
    if (perPageElement?.checkValidity()) {
        itemsPerPage = perPageElement.value;
    } else {
        alert("SAVE ERROR! \nNotifications Per Page value is invalid. Enter a number between 5-200. \nSave aborted.");
        return;
    }

    let settingsDict = {
        key: "options",
        value: {
            UseRelativeTime: useRelativeTime,
            UseDailyLargeCheck: useDailyLargeCheck,
            itemsPerPage: itemsPerPage,
        },
        extra: "",
    };

    db.settings.put(settingsDict).then(result => {
        return result;
    });
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
        }).then(function () {

            // Handle the initial sign-in state.
            emailGAPI.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

            // Listen for sign-in state changes.
            gapi.auth2.getAuthInstance().isSignedIn.listen(emailGAPI.updateSigninStatus);

        }, function (error) {
            //LATER errors to the database instead
            emailGAPIReady = false;
            console.log("🚀 YTBN ~ ", JSON.stringify(error, null, 2));
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

    const divHTML = `<div id="sidebuttons">
        <div id="sidebuttonsTop">
            <div id="filterContainer">
                <div style="position: absolute; margin: -11px 0px 0px 14px; font-size: 10pt; background: #151515; padding: 1px">Filter</div>
                <tp-yt-paper-input id="sidebarFilterInput" no-label-float placeholder="No Filter" style="width: 100%;"></tp-yt-paper-input>
                <div id="filterClearButton" title="Clear" style="display: none;">✖</div>
            </div>
            <div id="livesideButtons" style="border: 2px #3ea6ff44 solid; border-radius: 8px; margin: 0px 8px 6px 8px">
                <div style="position: absolute; margin: -12px 0px 0px 24px; font-size: 10pt; background: #151515; padding: 1px">Livestreams</div>
                <tp-yt-paper-checkbox style="margin-top: calc(0.5em + 4px)" id="hideliveCheckbox" noink>Hide</tp-yt-paper-checkbox>
                <tp-yt-paper-checkbox style="" id="livetransparencyCheckbox" noink checked>Opacity</tp-yt-paper-checkbox>
            </div>
            <div id="readsideButtons" style="border: 2px #3ea6ff44 solid; border-radius: 8px; margin: 8px 8px 6px 8px">
                <div style="position: absolute; margin: -12px 0px 0px 24px; font-size: 10pt; background: #151515; padding: 1px">Read</div>
                <tp-yt-paper-checkbox style="margin-top: calc(0.5em + 4px)" id="hidereadCheckbox" noink>Hide</tp-yt-paper-checkbox>
                <tp-yt-paper-checkbox style="" id="readtransparencyCheckbox" noink checked>Opacity</tp-yt-paper-checkbox>
            </div>
            <div id="commentsideButtons" style="border: 2px #3ea6ff44 solid; border-radius: 8px; margin: 8px 8px 6px 8px">
                <div style="position: absolute; margin: -12px 0px 0px 24px; font-size: 10pt; background: #151515; padding: 1px">Comments</div>
                <tp-yt-paper-checkbox style="margin-top: calc(0.5em + 4px)" id="hiderepliesCheckbox" noink>Hide</tp-yt-paper-checkbox>
                <tp-yt-paper-checkbox style="" id="commenttransparencyCheckbox" noink checked>Opacity</tp-yt-paper-checkbox>
            </div>
        </div>
        <div id="sidebuttonsBottom">
            <div id="ytb-status" class="ytb-status-hidden ytb-status"></div>
            <tp-yt-paper-button id="displayErrorListButton" raised class="" style="border: 1px #82c7f299 solid; font-size: 0.8em; text-align: center; margin: 12px 12px 0em 12px">ERRORS: NONE</tp-yt-paper-button>
            <tp-yt-paper-button id="displayOptionsButton" raised class="" style="border: 1px #82c7f299 solid; font-size: 0.8em; text-align: center; margin: 12px 12px 1em 12px">SETTINGS</tp-yt-paper-button>
            <tp-yt-paper-checkbox style="margin-top: 2em; margin-left: 24px" id="readallCheckbox" noink>Toggle All<br />Read/Unread</tp-yt-paper-checkbox>
        </div>
    </div>
    <div id="loadindicator" style="top: 43%; left: 46%; position: absolute">
        <div id="ytbnBlockingDiv" draggable="false" style="position: fixed; top: -50vh; left: -50vw; width: 200vw; height: 200vh; z-index: 99999999; background-color: rgba(0, 0, 0, 0.3);"></div>
        <tp-yt-paper-spinner active style="width: 70px; height: 70px"></tp-yt-paper-spinner>
        <div style="font-size: 2em; text-align: center; margin-left: -60%; margin-top: 6px">
            Loading...
            <br />
            Do not click anywhere...
            <br />
            Do not press anything...
        </div>
    </div>
    <div id="innerNotifications"></div>`;

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
    document.querySelector("#sidebuttons #displayErrorListButton").addEventListener('click', errorButtonClick);
    document.querySelector("#sidebuttons #sidebarFilterInput").addEventListener('keyup', sidebarFilterKeyup);
    document.querySelector("#sidebuttons #sidebarFilterInput").addEventListener('input', sidebarFilterInput);
    document.querySelector("#sidebuttons #sidebarFilterInput input").addEventListener('blur', sidebarFilterBlur);
    document.querySelector("#sidebuttons #filterClearButton").addEventListener('mousedown', filterClearMousedown);
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

function sidebarFilterKeyup(event) {
    if (event.key === "Enter") {
        filterPage();
    }
}

function sidebarFilterInput(event) {
    const clearButton = document.querySelector("#sidebuttonsTop #filterClearButton");
    if (event.target.value == "") {
        clearButton.style.display = "none";
    } else {
        clearButton.style.display = "flex";
    }
}

function filterClearMousedown(event) {
    document.querySelector('#sidebuttonsTop #sidebarFilterInput').value = "";
    event.target.style.display = "none";
    if (filterString != "") {
        filterPage();
    }
}

//Only apply filter if it hasn't been applied yet
function sidebarFilterBlur(event) {
    //Allow clicking the clear button using a delay
    setTimeout(() => {
        let inputfs = document.querySelector("#sidebuttonsTop #sidebarFilterInput").value;
        if (filterString != inputfs) {
            filterPage();
        }
    }, 200);
}

async function setupPaginationButtons() {

    let pagingButtonsDiv = document.createElement("div");
    pagingButtonsDiv.id = "pagingButtonsOuter";
    //LATER instead of using a fixed position, put the buttons and innernotifications in another container div
    pagingButtonsDiv.setAttribute("style", `
        position: fixed;
        width: 88%;
        bottom: 0px;
        margin-left: 4px;
        margin-bottom: -8px;
    `);
    let divHTML = `<div id="pagingButtons">
        <div class="notifRowItem" style="flex-grow: 0.8">
            <tp-yt-paper-button id="firstpageButton" raised class="" style="border: 1px #82c7f299 solid; font-size: 0.8em; text-align: center; margin: 12px 12px 12px 12px">First Page</tp-yt-paper-button>
        </div>
        <div class="notifRowItem" style="flex-grow: 1"></div>
        <div class="notifRowItem">
            <tp-yt-paper-button id="previouspageButton" raised class="" style="border: 1px #82c7f299 solid; font-size: 0.8em; text-align: center; margin: 12px 12px 12px 12px">Previous Page</tp-yt-paper-button>
        </div>
        <div class="notifRowItem" style="flex-grow: 0.5">
            <div id="pageNumber" style="text-align: center; font-size: 1.5em">CURRENTPAGENUMBER</div>
        </div>
        <div class="notifRowItem">
            <tp-yt-paper-button id="nextpageButton" raised class="" style="border: 1px #82c7f299 solid; font-size: 0.8em; text-align: center; margin: 12px 12px 12px 12px">Next Page</tp-yt-paper-button>
        </div>
        <div class="notifRowItem" style="flex-grow: 1"></div>
        <div class="notifRowItem" style="flex-grow: 0.8">
            <tp-yt-paper-button id="lastpageButton" raised class="" style="border: 1px #82c7f299 solid; font-size: 0.8em; text-align: center; margin: 12px 12px 12px 12px">Last Page</tp-yt-paper-button>
        </div>
    </div>
    `;
    divHTML = divHTML.replace('CURRENTPAGENUMBER', currentPage + 1);

    //If the previous buttons are still there, remove them.
    const pagingButtonsOuter = document.querySelector("#innerNotifications > #pagingButtonsOuter");
    if (pagingButtonsOuter) {
        pagingButtonsOuter.remove();
    }

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
    //Hide the options menu for now
    optionsDiv.style.visibility = false;

    const optionsHTML = `<div id="backgroundOverlay"></div>
    <div class="material-tabs">
        <div class="tabbed-section__selector">
            <a class="tabbed-section__selector-tab-1 active">GENERAL</a>
            <a class="tabbed-section__selector-tab-2">EMAIL</a>
            <a class="tabbed-section__selector-tab-3">ADVANCED</a>
            <span class="tabbed-section__highlighter"></span>
        </div>

        <div class="tabbed-section-1 visible">
            <tp-yt-paper-button id="loadallButton" raised class="" style="margin-top: auto">LOAD ALL NOTIFICATIONS</tp-yt-paper-button>
            <tp-yt-paper-checkbox id="optionRelativeTimeCheckbox" noink style="--tp-yt-paper-checkbox-ink-size: 54px; font-size: 12pt; margin: 50px auto 5px auto">Display relative time</tp-yt-paper-checkbox>
            <tp-yt-paper-checkbox id="optionDailyLargeCheckbox" noink style="--tp-yt-paper-checkbox-ink-size: 54px; font-size: 12pt; margin: 50px auto 5px auto">Daily large checks</tp-yt-paper-checkbox>
            <tp-yt-paper-input type="number" id="optionItemsPerPage" min="5" max="200" label="Notifications Per Page (5-200)" noink style="font-size: 12pt; margin: 50px auto 5px auto">Notifications Per Page</tp-yt-paper-input>
            <tp-yt-paper-button id="saveButtonOptions" raised class="" style="margin-top: auto; margin-bottom: 0px">SAVE</tp-yt-paper-button>
            <tp-yt-paper-button class="closeButtonSettings" raised class="" style="margin-top: 14px; margin-bottom: 0px">CLOSE</tp-yt-paper-button>
        </div>
        <div class="tabbed-section-2 hidden">
            <div style="display: flex; flex-direction: column; height: 100%">
                <h1 style="margin: 50px auto 30px auto; border-radius: 4px">Gmail API Setup</h1>
                <tp-yt-paper-textarea id="emailGAPIClientID" label="Client ID (Example: xxxx-xxxxxxxx.apps.googleusercontent.com)"></tp-yt-paper-textarea>
                <tp-yt-paper-textarea id="emailGAPIClientKey" label="API Key or Secret (Example: xxxxxxxxxxxxxx)"></tp-yt-paper-textarea>
                <tp-yt-paper-button id="authButtonEmail" raised class="" style="margin-top: 14px; margin-bottom: 0px; display: none">AUTHORIZE</tp-yt-paper-button>
                <tp-yt-paper-button id="signoutButtonEmail" raised class="" style="margin-top: 20px; margin-bottom: 20px; display: none">SIGN OUT</tp-yt-paper-button>
                <h1 style="margin: 50px auto 30px auto; border-radius: 4px">Email Setup</h1>
                <tp-yt-paper-textarea id="emailTo" label="To (Example: MyUsername@gmail.com)"></tp-yt-paper-textarea>
                <tp-yt-paper-textarea id="emailFrom" label="From (Example: MyUsername@gmail.com)"></tp-yt-paper-textarea>
                <tp-yt-paper-textarea id="emailSubject" label="Subject (Can use DUMMY values. Example: DUMMYCHANNELNAME has a new video: DUMMYVIDEOTITLE)"></tp-yt-paper-textarea>
                <tp-yt-paper-textarea id="emailBody" label="Body (Can use HTML as well as DUMMY values.)"></tp-yt-paper-textarea>
                <h3>❗❗❗ DUMMYVIDEOTITLE, DUMMYVIDEOIMAGEURL, DUMMYVIDEOLENGTH, DUMMYVIDEOURL, DUMMYCHANNELIMAGEURL, DUMMYCHANNELNAME, DUMMYCHANNELURL, DUMMYLIVEICON strings will be replaced with their respective values when an email is sent. Only for the Subject and the Body.</h3>
                <tp-yt-paper-checkbox id="sendEmailCheckbox" noink style="--tp-yt-paper-checkbox-ink-size: 54px; font-size: 12pt; margin-top: 8px">Send Email on New Notifications</tp-yt-paper-checkbox>
                <tp-yt-paper-button id="saveButtonEmail" raised class="" style="margin-top: 14px; margin-bottom: 0px">SAVE</tp-yt-paper-button>
                <tp-yt-paper-button id="sendEmailButton" raised class="" style="margin-top: 14px; margin-bottom: 14px">SEND TEST EMAILS</tp-yt-paper-button>
                <tp-yt-paper-button class="closeButtonSettings" raised class="" style="margin-top: auto; margin-bottom: 8px">CLOSE</tp-yt-paper-button>
                <br class="hideSMTPJS" />
                <h1 class="hideSMTPJS" style="margin: 50px auto 30px auto; color: crimson; border: 1px red solid; border-radius: 4px">Below Options are for SMTPJS. Please Ignore them.</h1>
                <br class="hideSMTPJS" />
                <tp-yt-paper-textarea class="hideSMTPJS" id="emailHost" label="Host (Example: smtp.gmail.com)"></tp-yt-paper-textarea>
                <tp-yt-paper-textarea class="hideSMTPJS" id="emailUsername" label="Username (Example: MyUsername or MyUsername@gmail.com)"></tp-yt-paper-textarea>
                <tp-yt-paper-textarea class="hideSMTPJS" id="emailPassword" label="Password (Example: MyPassword)"></tp-yt-paper-textarea>
                <tp-yt-paper-checkbox class="hideSMTPJS" id="useSecureTokenCheckbox" noink style="--tp-yt-paper-checkbox-ink-size: 54px; font-size: 12pt; margin-top: 8px">Use Security Token Instead (visit smtpjs.com)</tp-yt-paper-checkbox>
                <tp-yt-paper-textarea class="hideSMTPJS" id="emailSecureToken" label="Secure Token (Example: C973D7AD-F097-4B95-91F4-40ABC5567812)" disabled></tp-yt-paper-textarea>
                <tp-yt-paper-button class="hideSMTPJS closeButtonSettings" raised style="margin-top: auto; margin-bottom: 0px">CLOSE</tp-yt-paper-button>
            </div>
        </div>
        <div class="tabbed-section-3 hidden">
            <div style="text-align: center; font-size: 14pt; margin-top: auto; margin-bottom: 10px">Be careful with your exported passwords and secrets.</div>
            <tp-yt-paper-button id="exportDatabaseButton" raised class="" style="">EXPORT DATABASE</tp-yt-paper-button>
            <input type="file" id="importinput" name="importinput" accept=".json" style="width: 50%; margin-left: auto; margin-right: auto" />
            <tp-yt-paper-button for="importinput" id="importDatabaseButton" class="" style="">IMPORT DATABASE</tp-yt-paper-button>
            <br />
            <br />
            <br />
            <tp-yt-paper-button id="discardLogsButton" raised class="" style="margin-top: auto">CLEAR ALL LOGS</tp-yt-paper-button>
            <tp-yt-paper-button id="discardNotificationsButton" raised class="" style="margin-top: 50px; color: #ff3a3a">CLEAR ALL NOTIFICATIONS</tp-yt-paper-button>
            <tp-yt-paper-button id="discardSettingsButton" raised class="" style="margin-top: 12px; color: #ff3a3a">CLEAR ALL SETTINGS</tp-yt-paper-button>
            <tp-yt-paper-button class="closeButtonSettings" raised class="" style="margin-top: auto; margin-bottom: 0px">CLOSE</tp-yt-paper-button>
        </div>
    </div>
    `;

    document.querySelector("#outerNotifications").append(optionsDiv);
    optionsDiv.innerHTML = optionsHTML;

    let importInput = document.querySelector("#notificationOptions #importinput");
    importInput.outerHTML = importInput.outerHTML.replace("<input", "<tp-yt-paper-input");

    document.querySelector("#notificationOptions #discardNotificationsButton").addEventListener('click', discardNotifications);
    document.querySelector("#notificationOptions #discardLogsButton").addEventListener('click', discardLogs);
    document.querySelector("#notificationOptions #discardSettingsButton").addEventListener('click', discardSettings);
    document.querySelector("#notificationOptions #saveButtonEmail").addEventListener('click', saveOptionsEmail);
    document.querySelector("#notificationOptions #sendEmailButton").addEventListener('click', testEmail);
    document.querySelector("#notificationOptions #exportDatabaseButton").addEventListener('click', exportDB);
    document.querySelector("#notificationOptions #importDatabaseButton").addEventListener('click', importDB);
    document.querySelector("#notificationOptions #useSecureTokenCheckbox").addEventListener('click', useTokenCheckboxClicked);

    document.querySelector("#notificationOptions #saveButtonOptions").addEventListener('click', saveOptions);
    document.querySelector("#notificationOptions #loadallButton").addEventListener('click', loadAll);

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
    var toggleTab = function (element) {
        var parent = element.parentNode;

        // Do things on click
        document.querySelectorAll(element)[0].addEventListener('click', function () {
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
        //Load email tab
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

        //Load main options tab
        db.settings
            .where('key')
            .equals("options")
            .toArray().then(options => {
                if (options == null) {
                    return;
                }

                useRelativeTime = options[0].value.UseRelativeTime;
                useDailyLargeCheck = options[0].value?.UseDailyLargeCheck || false;
                document.querySelector("#optionRelativeTimeCheckbox").checked = useRelativeTime;
                document.querySelector("#optionDailyLargeCheckbox").checked = useDailyLargeCheck;
                document.querySelector("#optionItemsPerPage").value = itemsPerPage;
                return;
            });

    } catch (error) {
        console.log("🚀 YTBN ~ displayTabbedOptions -> error", { error });
    }

    //Finally, unhide the options menu
    optionsDiv.style.visibility = true;
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
