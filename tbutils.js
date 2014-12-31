function initwrapper() {
(function (TBUtils) {

    // We need these before we can do anything.
    TBUtils.modhash = $("form.logout input[name=uh]").val();
    TBUtils.logged = (TBUtils.modhash !== undefined) ? $('span.user a:first').html() : '';
    TBUtils.post_site = $('.redditname:not(.pagename) a:first').html();  // This may need to be changed to regex, if this is unreliable.

    // validate post_site. TODO: something better than this.
    if (TBUtils.post_site == "subreddits you moderate" || TBUtils.post_site == "mod (filtered)") {
        TBUtils.post_site = "";
    }

    //Private variables
    var modMineURL = '/subreddits/mine/moderator.json?count=100',
        now = new Date().getTime(),

        shortLength = TBStorage.getSetting('Utils', 'shortLength', 15),
        longLength = TBStorage.getSetting('Utils', 'longLength', 45),

        lastgetLong = TBStorage.getCache('Utils', 'lastGetLong', -1),
        lastgetShort = TBStorage.getCache('Utils', 'lastGetShort', -1),
        cacheName = TBStorage.getCache('Utils', 'cacheName', ''),
        seenNotes = TBStorage.getSetting('Utils', 'seenNotes', []),
        lastVersion = TBStorage.getSetting('Utils', 'lastVersion', 0),
        newLogin = (cacheName != TBUtils.logged),
        getnewLong = (((now - lastgetLong) / (60 * 1000) > longLength) || newLogin),
        getnewShort = (((now - lastgetShort) / (60 * 1000) > shortLength) || newLogin),
        betaRelease = false,  /// DO NOT FORGET TO SET FALSE BEFORE FINAL RELEASE! ///
        gettingModSubs = false,
        getModSubsCallbacks = [];

    var CHROME = 'chrome', FIREFOX = 'firefox', OPERA = 'opera', SAFARI = 'safari', UNKOWN_BROWSER = 'unknown',
        ECHO = 'echo', TB_KEY = 'Toolbox.';

    // Public variables
    TBUtils.toolboxVersion = '3.0.3' + ((betaRelease) ? ' (beta)' : '');
    TBUtils.shortVersion = 303; //don't forget to change this one!  This is used for the 'new version' notification.
    TBUtils.releaseName = 'Illuminati Ibis';
    TBUtils.configSchema = 1;
    TBUtils.notesSchema = 4;
    TBUtils.notesMinSchema = 2;
    TBUtils.notesMaxSchema = 5;     // The non-default max version (to allow phase-in schema releases)
    TBUtils.NO_WIKI_PAGE = 'NO_WIKI_PAGE';
    TBUtils.WIKI_PAGE_UNKNOWN = 'WIKI_PAGE_UNKNOWN';
    TBUtils.isModmail = location.pathname.match(/\/message\/(?:moderator)\/?/);
    TBUtils.isModmailUnread = location.pathname.match(/\/message\/(?:moderator\/unread)\/?/);
    TBUtils.isModpage = location.pathname.match(/\/about\/(?:reports|modqueue|spam|unmoderated|edited)\/?/);
    TBUtils.isEditUserPage = location.pathname.match(/\/about\/(?:contributors|moderator|banned)\/?/);
    TBUtils.isModFakereddit = location.pathname.match(/^\/r\/mod\b/);
    TBUtils.isToolbarPage = location.pathname.match(/^\/tb\//);
    TBUtils.isUnreadPage = location.pathname.match(/\/message\/(?:unread)\/?/);
    TBUtils.isModLogPage = location.pathname.match(/\/about\/(?:log)\/?/);
    TBUtils.isModQueuePage = location.pathname.match(/\/about\/(?:modqueue)\/?/);
    TBUtils.isUnmoderatedPage = location.pathname.match(/\/about\/(?:unmoderated)\/?/);
    TBUtils.isCommentsPage = location.pathname.match(/\?*\/(?:comments)\/?/);
    TBUtils.isUserPage = location.pathname.match(/\/(?:user)\/?/);
    TBUtils.isNewPage = location.pathname.match(/\?*\/(?:new)\/?/);
    TBUtils.isMod = $('body.moderator').length;
    TBUtils.isExtension = true;
    TBUtils.log = [];
    TBUtils.debugMode = TBStorage.getSetting('Utils', 'debugMode', false);
    TBUtils.devMode = TBStorage.getSetting('Utils', 'devMode', false);
    TBUtils.betaMode = TBStorage.getSetting('Utils', 'betaMode', false);
    TBUtils.browser = TBStorage.browser;
    TBUtils.firstRun = false;


    // Check our post site.  We might want to do some sort or regex fall back here, if it's needed.
    if (TBUtils.isModFakereddit || TBUtils.post_site === undefined || !TBUtils.post_site) {
        TBUtils.post_site = '';
    }


    // Do settings echo before anything else.  If it fails, exit toolbox.
    var ret = TBStorage.setSetting('Utils', 'echoTest', ECHO);
    if (ret !== ECHO) {
        alert('toolbox can not save settings to localstorage\n\ntoolbox will now exit');
        return;
    }


    // Get cached info.
    TBUtils.noteCache = (getnewShort) ? {} : TBStorage.getCache('Utils', 'noteCache', {});
    TBUtils.configCache = (getnewLong) ? {} : TBStorage.getCache('Utils', 'configCache', {});
    TBUtils.noConfig = (getnewShort) ? [] : TBStorage.getCache('Utils', 'noConfig', []);
    TBUtils.noNotes = (getnewShort) ? [] : TBStorage.getCache('Utils', 'noNotes', []);
    TBUtils.mySubs = (getnewLong) ? [] : TBStorage.getCache('Utils', 'moderatedSubs', []);
    TBUtils.mySubsData = (getnewLong) ? [] : TBStorage.getCache('Utils', 'moderatedSubsData', []);


    // Update cache vars as needed.
    if (newLogin) {
        TBStorage.setCache('Utils', 'cacheName', TBUtils.logged);
    }

    if (getnewLong) {
        TBStorage.setCache('Utils', 'lastGetLong', now);
    }

    if (getnewShort) {
        TBStorage.setCache('Utils', 'lastGetShort', now);
    }

    var pushedunread = TBStorage.getSetting('Notifier', 'unreadPushed', []);
    if (pushedunread.length > 250) {
        pushedunread.splice(150, (pushedunread.length - 150));
        TBStorage.setSetting('Notifier', 'unreadPushed', pushedunread);
    }

    var pusheditems = TBStorage.getSetting('Notifier', 'modqueuePushed', []);
    if (pusheditems.length > 250) {
        pusheditems.splice(150, (pusheditems.length - 150));
        TBStorage.setSetting('Notifier', 'modqueuePushed', pusheditems);
    }

    var repliedModmail = TBStorage.getSetting('ModMail', 'replied', []);
    if (repliedModmail.length > 250) {
        pusheditems.splice(150, (repliedModmail.length - 150));
        TBStorage.setSetting('ModMail', 'replied', repliedModmail);
    }

    if (seenNotes.length > 250) {
        $.log("clearing seen notes");
        seenNotes.splice(150, (seenNotes.length - 150));
        TBStorage.setSetting('Utils', 'seenNotes', seenNotes);
    }


    // First run changes.
    if (TBUtils.shortVersion > lastVersion) {
        TBUtils.firstRun = true; // for use by other modules.
        TBStorage.setSetting('Utils', 'lastVersion', TBUtils.shortVersion); //set last version to this version.

        //** This should be a per-release section of stuff we want to change in each update.  Like setting/converting data/etc.  It should always be removed before the next release. **//

        // Start: version changes.
        /* TBUtils.[get/set]Setting IS NOT DEFINDED YET!!!  Use TBStorage.[get/set]settings */

        // 3.0.1 version changes
        $.log('Running ' + TBUtils.toolboxVersion + ' changes', true, 'TBUtils');

        var botCheck = TBStorage.getSetting('QueueTools', 'botCheckmark', ['AutoModerator']),
            index = botCheck.indexOf('automoderator');
        if (index > -1){
            botCheck[index] = 'AutoModerator';
            TBStorage.setSetting('QueueTools', 'botCheckmark', botCheck);
        }

        TBStorage.setSetting('ModMail', 'enabled', true);

        // End: version changes.

        // These two should be left for every new release. If there is a new beta feature people want, it should be opt-in, not left to old settings.
        //TBStorage.setSetting('Notifier', 'lastSeenModmail', now); // don't spam 100 new mod mails on first install.
        //TBStorage.setSetting('Notifier', 'modmailCount', 0);
        TBStorage.setSetting('Utils', 'debugMode', false);
        TBStorage.setSetting('Utils', 'betaMode', false);
        TBUtils.debugMode = false;
        TBUtils.betaMode = false;
    }


    if (TBUtils.debugMode) {
        var consoleText = 'Toolbox version: ' + TBUtils.toolboxVersion +
            ', Browser: ' + TBUtils.browser +
            ', Extension: ' + TBUtils.isExtension +
            ', Beta features: ' + TBUtils.betaMode +
            '\n';

        TBUtils.log.push(consoleText);
    }


    TBUtils.usernotes = {
        ver: TBUtils.notesSchema,
        users: [] //typeof userNotes
    };


    TBUtils.note = {
        note: '',
        time: '',
        mod: '',
        link: '',
        type: ''
    };


    TBUtils.warningType = ['spamwatch', 'spamwarn', 'abusewarn', 'ban', 'permban', 'botban'];


    TBUtils.config = {
        ver: TBUtils.configSchema,
        domainTags: '',
        removalReasons: '',
        modMacros: ''
    };

    TBUtils.getTypeInfo = function (warningType) {
        var typeInfo = {
            name: '',
            color: '',
            text: ''
        };

        switch (String(warningType)) { //not sure why it gets passed as an array.
            case 'spamwatch':
                typeInfo = {color: 'fuchsia', name: 'Watching', text: 'Spam Watch'};
                break;
            case 'spamwarn':
                typeInfo = {color: 'purple', name: 'Warned', text: 'Spam Warning'};
                break;
            case 'abusewarn':
                typeInfo = {color: 'orange', name: 'Warned', text: 'Abuse Warning'};
                break;
            case 'ban':
                typeInfo = {color: 'red', name: 'Banned', text: 'Ban'};
                break;
            case 'permban':
                typeInfo = {color: 'darkred', name: 'Perma-banned', text: 'Permanent Ban'};
                break;
            case 'botban':
                typeInfo = {color: 'black', name: 'Bot Banned', text: 'Shadow Ban'};
                break;
            default:
                typeInfo = {color: '', name: '', text: 'none'};
        }

        return typeInfo;
    };

    //
    TBUtils.minutesToMilliseconds = function(mins) {
        var oneMin = 60000,
            milliseconds = mins * 60 * 1000;

        // Never return less than one min.
        if (milliseconds < oneMin) {
            milliseconds = oneMin
        }

        return milliseconds;
    };

    // convert unix epoch timestamps to ISO format
    TBUtils.timeConverterISO = function (UNIX_timestamp) {
        var a = new Date(UNIX_timestamp * 1000);
        var year = a.getFullYear();
        var month = ('0' + (a.getUTCMonth() + 1)).slice(-2);
        var date = ('0' + a.getUTCDate()).slice(-2);
        var hour = ('0' + a.getUTCHours()).slice(-2);
        var min = ('0' + a.getUTCMinutes()).slice(-2);
        var sec = ('0' + a.getUTCSeconds()).slice(-2);
        return year + '-' + month + '-' + date + 'T' + hour + ':' + min + ':' + sec + 'Z';
    };


    // convert unix epoch timestamps to readable format dd-mm-yyyy hh:mm:ss UTC
    TBUtils.timeConverterRead = function (UNIX_timestamp) {
        var a = new Date(UNIX_timestamp * 1000);
        var year = a.getFullYear();
        var month = ('0' + (a.getUTCMonth() + 1)).slice(-2);
        var date = ('0' + a.getUTCDate()).slice(-2);
        var hour = ('0' + a.getUTCHours()).slice(-2);
        var min = ('0' + a.getUTCMinutes()).slice(-2);
        var sec = ('0' + a.getUTCSeconds()).slice(-2);
        return date + '-' + month + '-' + year + ' ' + hour + ':' + min + ':' + sec + ' UTC';
    };

    // convert titles to a format usable in urls
    // from r2.lib.utils import title_to_url
    TBUtils.title_to_url = function (title) {
        var max_length = 50;

        title = title.replace(/\s+/g, "_");     //remove whitespace
        title = title.replace(/\W+/g, "");      //remove non-printables
        title = title.replace(/_+/g, "_");      //remove double underscores
        title = title.replace(/^_+|_+$/g, "");  //remove trailing underscores
        title = title.toLowerCase();            //lowercase the title

        if (title.length > max_length) {
            title = title.substr(0, max_length);
            title = title.replace(/_[^_]*$/g, "");
        }

        return title || "_";
    };

    // Easy way to use templates. Usage example:
    //    TBUtils.template('/r/{{subreddit}}/comments/{{link_id}}/{{title}}/', {
    //                'subreddit': 'toolbox',
    //                'title':  title_to_url('this is a title we pulled from a post),
    //                'link_id': '2kwx2o'
    //            });
    TBUtils.template = function (tpl, variables) {
        return tpl.replace(/{{([^}]+)}}/g, function (match, variable) {
            return variables[variable];
        });
    };

    // TODO: This should probably be removed in the future since text feedback can now take of this.
    TBUtils.pageOverlay = function (text, createOrDestroy) {
        var $body = $('body');

        if (createOrDestroy !== undefined) {

            // Create the overlay
            if (createOrDestroy) {
                var html = '\
    <div class="tb-internal-overlay">\
    <div class="tb-overlay-label"></div></div>\
    ';
                TBui.longLoadSpinner(true);
                $body.find('.tb-popup-tabs').after(html);
            }

            // Destory the overlay
            else {
                $body.find('.tb-internal-overlay').remove();
                TBui.longLoadSpinner(false);
            }
        }

        // Regardless, update the text.  It doen't matter if you pass text for destroy.
        $body.find('.tb-overlay-label').html(text);
        // Also pass the text to the new text feedback
        if (text !== null) {
            TBui.textFeedback(text, 'neutral');
        }

    };

    TBUtils.alert = function (message, callback) {
        var $noteDiv = $('<div id="tb-notification-alert"><span>' + message + '</span></div>');
        $noteDiv.append('<img src="data:image/png;base64,' + TBui.iconClose + '" class="note-close" title="Close" />');
        $noteDiv.appendTo('body');

        $noteDiv.click(function (e) {
            $noteDiv.remove();
            if (e.target.className === 'note-close') {
                callback(false);
                return;
            }
            callback(true);
        });
    };


    TBUtils.showNote = function (note) {
        if (!note.id || !note.text) return;

        function show() {
            if ($.inArray(note.id, seenNotes) === -1) {
                //TBStorage.setSetting('Utils', 'noteLastShown', now);

                TBUtils.alert(note.text, function (resp) {
                    seenNotes.push(note.id);
                    TBStorage.setSetting('Utils', 'seenNotes', seenNotes);
                    if (note.link && note.link.match(/^(https?\:|\/)/i) && resp) window.open(note.link);
                });
            }
        }

        //platform check.
        switch (note.platform) {
            case 'firefox':
                if (TBUtils.browser == FIREFOX && TBUtils.isExtension) show();
                break;
            case 'chrome':
                if (TBUtils.browser == CHROME && TBUtils.isExtension) show();
                break;
            case 'opera':
                if (TBUtils.browser == OPERA && TBUtils.isExtension) show();
                break;
            case 'safari':
                if (TBUtils.browser == SAFARI && TBUtils.isExtension) show();
                break;
            case 'script':
                if (!TBUtils.isExtension) show();
                break;
            case 'all':
                show();
                break;
            default:
                show();
        }
    };


    TBUtils.notification = function (title, body, url, markreadid) {
        var timeout = 10000;

        var toolboxnotificationenabled = true;

        // check if notifications are enabled. When they are not we simply abort the function.
        if (toolboxnotificationenabled === false) {
            //console.log('notifications disabled, stopping function');
            return;
        }

        if (!('Notification' in window)) {
            // fallback on a javascript notification
            $.log('boring old rickety browser, falling back on jquery based notifications');
            body = body.replace(/(?:\r\n|\r|\n)/g, '<br />');
            $.sticky('<strong>' + title + '</strong><br><p><a href="' + url + '">' + body + '<a></p>', {'autoclose': timeout});

        } else if (Notification.permission === 'granted') {

            var notification = new Notification(title, {
                dir: "auto",
                body: body,
                icon: "data:image/png;base64," + TBui.logo64
            });
            setTimeout(function () {
                notification.close()
            }, timeout);

            notification.onclick = function () {
                // Open the page
                $.log('notification clicked', false, 'TBUtils');
                if (markreadid !== 'undefined') {
                    $.post('/api/read_message', {
                        id: markreadid,
                        uh: TBUtils.modhash,
                        api_type: 'json'
                    });
                }

                open(url);
                // Remove notification
                this.close();
            }

        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission(function (permission) {

                // Whatever the user answers, we make sure we store the information
                if (!('permission' in Notification)) {
                    Notification.permission = permission;
                }

                // If the user is okay, let's create a notification
                if (permission === 'granted') {
                    var notification = new Notification(title, {
                        dir: "auto",
                        body: body,
                        icon: "data:image/png;base64," + TBui.logo64
                    });
                    setTimeout(function () {
                        notification.close()
                    }, timeout);

                    notification.onclick = function () {
                        // Open the page
                        $.log('notification clicked', false, 'TBUtils');
                        if (markreadid !== 'undefined') {
                            $.post('/api/read_message', {
                                id: markreadid,
                                uh: TBUtils.modhash,
                                api_type: 'json'
                            });
                        }
                        open(url);
                        // Remove notification
                        this.close();
                    }
                }
            });
        } else {
            // They have the option enabled, but won't grant permissions, so fall back.
            body = body.replace(/(?:\r\n|\r|\n)/g, '<br />');
            $.sticky('<strong>' + title + '</strong><br><p><a href="' + url + '">' + body + '<a></p>', {'autoclose': timeout});
        }
    };


    TBUtils.humaniseDays = function (diff) {
        var str = '';
        var values = {
            ' year': 365,
            ' month': 30,
            ' week': 7,
            ' day': 1
        };

        for (var x in values) {
            var amount = Math.floor(diff / values[x]);

            if (amount >= 1) {
                str += amount + x + (amount > 1 ? 's' : '') + ' ';
                diff -= amount * values[x];
            }
        }
        return str.slice(0, -1);
    };


    TBUtils.sortBy = function (arr, prop) {
        return arr.sort(function (a, b) {
            if (a[prop] < b[prop]) return 1;
            if (a[prop] > b[prop]) return -1;
            return 0;
        });
    };


    // Because normal .sort() is case sensitive.
    TBUtils.saneSort = function (arr) {
        return arr.sort(function (a, b) {
            if (a.toLowerCase() < b.toLowerCase()) return -1;
            if (a.toLowerCase() > b.toLowerCase()) return 1;
            return 0;
        });
    };


    TBUtils.saneSortAs = function (arr) {
        return arr.sort(function (a, b) {
            if (a.toLowerCase() > b.toLowerCase()) return -1;
            if (a.toLowerCase() < b.toLowerCase()) return 1;
            return 0;
        });
    };


    TBUtils.cleanSubredditName = function(dirtySub) {
        return dirtySub.replace('/r/', '').replace('/', '').replace('[-]', '').replace('[+]', '').trim();
    };


    TBUtils.getModSubs = function (callback) {
        //$.log('getting mod subs');
        // If it has been more than ten minutes, refresh mod cache.
        if (TBUtils.mySubs.length < 1 || TBUtils.mySubsData.length < 1) {
            // time to refresh
            if (gettingModSubs) {
                // we're already fetching a new list, so enqueue the callback
                $.log('Enqueueing getModSubs callback', false, 'TBUtils');
                getModSubsCallbacks.push(callback);
            } else {
                // start the process
                $.log('getting new subs.');

                gettingModSubs = true;
                TBUtils.mySubs = []; // reset
                TBUtils.mySubsData = [];
                getSubs(modMineURL);
            }
        } else {
            // run callback on cached sublist
            TBUtils.mySubs = TBUtils.saneSort(TBUtils.mySubs);
            TBUtils.mySubsData = TBUtils.sortBy(TBUtils.mySubsData, 'subscribers');
            // Go!
            callback();
        }

        function getSubs(URL) {
            $.getJSON(URL, function (json) {
                getSubsResult(json.data.children, json.data.after);
            });
        }

        // Callback because reddits/mod/mine is paginated.
        function getSubsResult(subs, after) {
            $(subs).each(function () {
                var sub = this.data.display_name.trim();
                if ($.inArray(sub, TBUtils.mySubs) === -1) {
                    TBUtils.mySubs.push(sub);
                }

                var isinthere = false;
                $(TBUtils.mySubsData).each(function () {
                    if (this.subreddit === sub) {
                        isinthere = true
                    }
                });

                if (!isinthere) {
                    var subredditData = {
                        "subreddit": sub,
                        "subscribers": this.data.subscribers,
                        "over18": this.data.over18,
                        "created_utc": this.data.created_utc,
                        "subreddit_type": this.data.subreddit_type,
                        "submission_type": this.data.submission_type
                    };

                    TBUtils.mySubsData.push(subredditData);
                }
            });

            if (after) {
                var URL = modMineURL + '&after=' + after;
                getSubs(URL);
            } else {
                TBUtils.mySubs = TBUtils.saneSort(TBUtils.mySubs);
                TBUtils.mySubsData = TBUtils.sortBy(TBUtils.mySubsData, 'subscribers');
                // Update the cache.
                TBStorage.setCache('Utils', 'moderatedSubs', TBUtils.mySubs);
                TBStorage.setCache('Utils', 'moderatedSubsData', TBUtils.mySubsData);

                callback();
                // no idea what the following shit is.
                // Go!
                while (getModSubsCallbacks.length > 0) {
                    // call them in the order they were added
                    $.log("calling callback " + getModSubsCallbacks[0].name);
                    getModSubsCallbacks[0]();
                    getModSubsCallbacks.splice(0, 1); // pop first element
                }
                // done
                gettingModSubs = false;
            }
        }
    };

    TBUtils.getThingInfo = function (sender, modCheck) {
        // If we were passed in a .thing, we may have to walk down the tree to
        // find the associated .entry
        var $sender = $(sender),
            $entry = $($sender.closest('.entry')[0] || $sender.find('.entry')[0] || $sender),
            $thing = $($sender.closest('.thing')[0] || $sender),
            user = $entry.find('.author:first').text() || $thing.find('.author:first').text(),
            subreddit = TBUtils.post_site || $entry.find('.subreddit').text() || $thing.find('.subreddit').text() || $entry.find('.tagline .head b > a[href^="/r/"]:not(.moderator)').text(),
            permalink = $entry.find('a.bylink').attr('href') || $entry.find('.buttons:first .first a').attr('href') || $thing.find('a.bylink').attr('href') || $thing.find('.buttons:first .first a').attr('href'),
            domain = ($entry.find('span.domain:first').text() || $thing.find('span.domain:first').text()).replace('(', '').replace(')', ''),
            id = $entry.attr('data-fullname') || $thing.attr('data-fullname') || $sender.closest('.usertext').find('input[name=thing_id]').val(),

        // These need some fall backs, but only removal reasons use them for now.
            title = $thing.find('a.title').length ? $thing.find('a.title').text() : '',
            kind = $thing.hasClass('link') ? 'submission' : 'comment',
            postlink = $thing.find('a.title').attr('href');

        // removed? spam or ham?
        var removal = ($entry.find('.flat-list.buttons li b:contains("removed by")').text() || '').match(/removed by (.+) \(((?:remove not |confirm )?spam)/) || [],
            banned_by = removal[1] || '',
            spam = removal[2] == 'spam' || removal[2] == 'confirm spam',
            ham = removal[2] == 'remove not spam';

        if (TBUtils.isEditUserPage && !user) {
            user = $sender.closest('.user').find('a:first').text() || $entry.closest('.user').find('a:first').text() || $thing.closest('.user').find('a:first').text();
        }


        // If we still don't have a sub, we're in mod mail, or PMs.
        if (TBUtils.isModmail || $sender.closest('.message-parent')[0] !== undefined) {
            subreddit = (subreddit) ? subreddit : ($entry.find('.head a:last').text() || $thing.find('.head a:last').text());

            //This is a weird palce to go about this, and the conditions are strange,
            //but if we're going to assume we're us, we better make damned well sure that is likely the case.
            // if ($entry.find('.remove-button').text() === '') {
            // The previous check would mistakenly catch removed modmail messages as the user's messages.
            // This check should be safe, since the only time we get no username in modmail is the user's own message. -dakta
            // The '.message-parent' check fixes reddit.com/message/messages/, which contains mod mail and PMs.

            // There are two users in the tagline, the first one is the user sending the message so we want to target that user.
            if ($entry.find('.tagline .head a.author').length > 1) {
                user = $entry.find('.tagline .head a.author').eq(0).text();
            }

            // If there is only one use present and it says "to" it means that this is not the user sending the message.

            if ($entry.find('.tagline .head a.author').length === 1 && /^to /.test($entry.find('.tagline .head').text())) {
                user = TBUtils.logged;
            }

            if (user === '') {
                user = TBUtils.logged;

                if (!subreddit || subreddit.indexOf('/r/') < 1) {
                    // Find a better way, I double dog dare ya!
                    subreddit = $thing.closest('.message-parent').find('.correspondent.reddit.rounded a').text()
                }
            }


        }

        // A recent reddit change makes subreddit names sometimes start with "/r/".
        // Mod mail subreddit names additionally end with "/".
        // reddit pls, need consistency
        subreddit = TBUtils.cleanSubredditName(subreddit);

        // Not a mod, reset current sub.
        if (modCheck && $.inArray(subreddit, TBUtils.mySubs) === -1) {
            subreddit = '';
        }

        if (user == '[deleted]') {
            user = '';
        }

        var approved_text = $entry.find('.approval-checkmark').attr('title') || $thing.find('.approval-checkmark').attr('title') || '';
        approved_by = approved_text.match(/by\s(.+?)\s/) || '';

        var info = {
            subreddit: subreddit,
            user: user,
            author: user,
            permalink: permalink,
            url: permalink,
            domain: domain,
            id: id,
            approved_by: approved_by,
            title: title,
            kind: kind,
            postlink: postlink,
            link: postlink,
            banned_by: banned_by,
            spam: spam,
            ham: ham
        };
        //$.log(info);
        return info;
    };

    TBUtils.replaceTokens = function (info, content) {
        $.log(info);
        for (var i in info) {
            var pattern = new RegExp('{' + i + '}', 'mig');
            content = content.replace(pattern, info[i]);
        }

        return content;
    };


    // Prevent page lock while parsing things.  (stolen from RES)
    TBUtils.forEachChunked = function (array, chunkSize, delay, call, complete) {
        if (array === null) finish();
        if (chunkSize === null || chunkSize < 1) finish();
        if (delay === null || delay < 0) finish();
        if (call === null) finish();
        var counter = 0;
        //var length = array.length;

        function doChunk() {
            for (var end = Math.min(array.length, counter + chunkSize); counter < end; counter++) {
                var ret = call(array[counter], counter, array);
                if (ret === false) finish();
            }
            if (counter < array.length) {
                window.setTimeout(doChunk, delay);
            } else {
                finish();
            }
        }
        window.setTimeout(doChunk, delay);

        function finish() {
            return complete ? complete() : false;
        }
    };

    // Reddit API stuff
    TBUtils.postToWiki = function postToWiki(page, subreddit, data, reason, isJSON, updateAM, callback) {
        if (reason) {
            reason = '"' + reason + '" via toolbox';
        } else {
            reason = 'updated via toolbox';
        }

        if (isJSON) {
            // Not indenting saves precious bytes.
            //data = JSON.stringify(data, undefined, TBUtils.debugMode ? 2 : undefined);
            data = JSON.stringify(data);
        }

        $.log("Posting /r/" + subreddit + "/api/wiki/edit/" + page);


        // If we update automoderator we want to replace any tabs with four spaces.
        if (updateAM) {
            data = data.replace(/\t/g, "    ");
        }

        $.post('/r/' + subreddit + '/api/wiki/edit', {
            content: data,
            page: page,
            // reason: 'updated via toolbox config',
            reason: reason,
            uh: TBUtils.modhash
        })

            .error(function postToWiki_error(err) {
                $.log(err);
                callback(false, err.responseText);
            })

            .success(function () {
                // Callback regardless of what happens next.  We wrote to the page.
                callback(true);

                if (updateAM) {
                    $.post('/api/compose', {
                        to: 'automoderator',
                        uh: TBUtils.modhash,
                        subject: subreddit,
                        text: 'update'
                    })
                        .success(function () {
                            TB.ui.textFeedback('sucessfully sent update PM to automoderator', TBui.FEEDBACK_POSITIVE);
                        })
                        .error(function () {
                            TB.ui.textFeedback('error sending update PM to automoderator', TB.ui.FEEDBACK_NEGATIVE);
                            window.location = '/message/compose/?to=AutoModerator&subject=' + subreddit + '&message=update';
                        });
                }

                setTimeout(function () {

                    // Set page access to 'mod only'.
                    $.post('/r/' + subreddit + '/wiki/settings/', {
                        page: page,
                        listed: true, //hrm, may need to make this a config setting.
                        permlevel: 2,
                        uh: TBUtils.modhash
                    })

                        // Super extra double-secret secure, just to be safe.
                        .error(function (err) {
                            alert('error setting wiki page to mod only access');
                            window.location = '/r/' + subreddit + '/wiki/settings/' + page;
                        });

                }, 500);
            });
    };


    // reddit HTML encodes all of their JSON responses, we need to HTMLdecode
    // them before parsing.
    TBUtils.unescapeJSON = function (val) {
        if (typeof(val) == "string") {
            val = val.replace(/&quot;/g, '"')
                .replace(/&gt;/g, ">").replace(/&lt;/g, "<")
                .replace(/&amp;/g, "&");
        }
        return val;
    };


    TBUtils.readFromWiki = function (subreddit, page, isJSON, callback) {
        // We need to demangle the JSON ourselves, so we have to go about it this way :(
        $.ajax('/r/' + subreddit + '/wiki/' + page + '.json', {
            dataType: "json",
            dataFilter: function (data, type) {
                //TODO: right now a lot of functions implicitly rely on reddit
                //returning escaped JSON to operate safely. add this back in once
                //everything's been audited.

                //return TBUtils.unescapeJSON(data);
                return data;
            }
        })
            .done(function (json) {
                var wikiData = json.data.content_md;

                if (!wikiData) {
                    callback(TBUtils.NO_WIKI_PAGE);
                    return;
                }

                if (isJSON) {
                  try{
                    wikiData = JSON.parse(wikiData);
                    if (wikiData) {
                        callback(wikiData);
                    } else {
                        callback(TBUtils.NO_WIKI_PAGE);
                    }
                  }
                  catch(err)
                  {
                    // we should really have a INVAILD_DATA error for this.
                    $.log(err, false, 'TBUtils')
                    callback(TBUtils.NO_WIKI_PAGE);
                  }
                  return;
                }

                // We have valid data, but it's not JSON.
                callback(wikiData);

            })
            .fail(function (jqXHR, textStatus, e) {
              $.log('Wiki page error: ' + e, false, 'TBUtils')
                if (jqXHR.responseText  === undefined) {
                    callback(TBUtils.WIKI_PAGE_UNKNOWN);
                    return;
                }

                var reason = JSON.parse(jqXHR.responseText).reason || '';
                if (reason == 'PAGE_NOT_CREATED' || reason == 'WIKI_DISABLED') {
                    callback(TBUtils.NO_WIKI_PAGE);
                } else {
                    // we don't know why it failed, we should not try to write to it.
                    callback(TBUtils.WIKI_PAGE_UNKNOWN);
                }
            });
    };


    TBUtils.redditLogin = function (uname, pass, remeber, callback) {
        $.post('/api/login', {
            api_type: 'json',
            passwd: pass,
            user: uname,
            rem: remeber
        })
            .success(function () {
                if (typeof callback !== "undefined")
                    callback(true);
            })
            .error(function (error) {
                $.log(error);
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };


    TBUtils.getBanState = function (subreddit, user, callback) {
        $.get("/r/" + subreddit + "/about/banned/.json", {user: user}, function (data) {
            var banned = data.data.children;

            // If it's over or under exactly one item they are not banned or that is not their full name.
            if (banned.length !== 1) {
                return callback(false);
            }

            callback(true, banned[0].note, banned[0].date, banned[0].name);
        });
    };


    TBUtils.flairPost = function (postLink, subreddit, text, cssClass, callback) {
        $.post('/api/flair', {
            api_type: 'json',
            link: postLink,
            text: text,
            css_class: cssClass,
            r: subreddit,
            uh: TBUtils.modhash
        })
            .success(function () {
                if (typeof callback !== "undefined")
                    callback(true);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.flairUser = function (user, subreddit, text, cssClass, callback) {
        $.post('/api/flair', {
            api_type: 'json',
            name: user,
            r: subreddit,
            text: text,
            css_class: cssClass,
            uh: TBUtils.modhash
        })
            .success(function () {
                if (typeof callback !== "undefined")
                    callback(true);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.friendUser = function (user, action, subreddit, banReason, banMessage, banDuration, callback) {
        $.post('/api/friend', {
            api_type: 'json',
            uh: TBUtils.modhash,
            type: action,
            name: user,
            r: subreddit,
            note: banReason,
            ban_message: banMessage,
            duration: banDuration
        })
            .success(function (response) {
                if (typeof callback !== "undefined")
                    callback(true, response);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.unfriendUser = function (user, action, subreddit, callback) {
        $.post('/api/unfriend', {
            api_type: 'json',
            uh: TBUtils.modhash,
            type: action,
            name: user,
            r: subreddit
        })
            .success(function (response) {
                if (typeof callback !== "undefined")
                    callback(true, response);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.distinguishThing = function (id, callback) {
        $.post('/api/distinguish/yes', {
            id: id,
            uh: TBUtils.modhash
        })
            .success(function () {
                if (typeof callback !== "undefined")
                    callback(true);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };


    TBUtils.approveThing = function (id, callback) {
        $.post('/api/approve', {
            id: id,
            uh: TBUtils.modhash
        })
            .success(function () {
                if (typeof callback !== "undefined")
                    callback(true);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.removeThing = function (id, spam, callback) {
        $.post('/api/remove', {
            uh: TBUtils.modhash,
            id: id,
            spam: spam
        })
            .success(function () {
                if (typeof callback !== "undefined")
                    callback(true);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.postComment = function (parent, text, callback) {
        $.post('/api/comment', {
            parent: parent,
            uh: TBUtils.modhash,
            text: text,
            api_type: 'json'
        })
            .success(function (response) {
                if (response.json.hasOwnProperty("errors") && response.json.errors.length > 0) {
                    $.log("Failed to post comment to on " + parent);
                    $.log(response.json.errors);
                    if (typeof callback !== "undefined")
                        callback(false, response.json.errors);
                    return;
                }

                $.log("Successfully posted comment on " + parent);
                if (typeof callback !== "undefined")
                    callback(true, response);
            })
            .error(function (error) {
                $.log("Failed to post link to on" + parent);
                $.log(error);
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.postLink = function (link, title, subreddit, callback) {
        $.post('/api/submit', {
            kind: 'link',
            resubmit: 'true',
            url: link,
            uh: TBUtils.modhash,
            title: title,
            sr: subreddit,
            api_type: 'json'
        })
            .success(function (response) {
                if (response.json.hasOwnProperty("errors") && response.json.errors.length > 0) {
                    $.log("Failed to post link to /r/" + subreddit);
                    $.log(response.json.errors);
                    if (typeof callback !== "undefined")
                        callback(false, response.json.errors);
                    return;
                }

                $.log("Successfully posted link to /r/" + subreddit);
                if (typeof callback !== "undefined")
                    callback(true, response);
            })
            .error(function (error) {
                $.log("Failed to post link to /r/" + subreddit);
                $.log(error);
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.sendMessage = function (user, subject, message, subreddit, callback) {
        $.post('/api/compose', {
            from_sr: subreddit,
            subject: subject,
            text: message,
            to: user,
            uh: TBUtils.modhash,
            api_type: 'json'
        })
            .success(function (response) {
                if (response.json.hasOwnProperty("errors") && response.json.errors.length > 0) {
                    $.log("Failed to send link to /u/" + user);
                    $.log(response.json.errors);
                    if (typeof callback !== "undefined")
                        callback(false, response.json.errors);
                    return;
                }

                $.log("Successfully send link to /u/" + user);
                if (typeof callback !== "undefined")
                    callback(true, response);
            })
            .error(function (error) {
                $.log("Failed to send link to /u/" + user);
                $.log(error);
                if (typeof callback !== "undefined")
                    callback(false, error);
            });
    };

    TBUtils.sendPM = function (to, subject, message, callback) {
        $.post('/api/compose', {
            to: to,
            uh: TBUtils.modhash,
            subject: subject,
            text: message
        })
            .success(function () {
                if (typeof callback !== "undefined")
                    callback(true);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error.responseText);
            });
    };

    TBUtils.markMessageRead = function (id, callback) {
        $.post('/api/read_message', {
            api_type: 'json',
            id: id,
            uh: TBUtils.modhash
        });
    };

    TBUtils.aboutUser = function (user, callback) {
        $.get('/user/'+ user +'/about.json', {
            uh: TBUtils.modhash
        })
            .success(function (response) {
                if (typeof callback !== "undefined")
                    callback(true, response);
            })
            .error(function (error) {
                if (typeof callback !== "undefined")
                    callback(false, error.responseText);
            });
    };

    // Import export methods
    TBUtils.exportSettings = function (subreddit, callback) {
        var settingsObject = {};
        $(TBStorage.settings).each(function () {
            if (this == 'Storage.settings') return; // don't backup the setting registry.

            var key = this.split("."),
                setting = TBStorage.getSetting(key[0], key[1], null);

            if (setting !== null && setting !== undefined) { // DO NOT, EVER save null (or undefined, but we shouldn't ever get that)
                settingsObject[this] = setting;
            }
        });

        TBUtils.postToWiki('tbsettings', subreddit, settingsObject, 'exportSettings', true, false, function () {
            callback();
        });
    };


    TBUtils.importSettings = function (subreddit, callback) {
        TBUtils.readFromWiki(subreddit, 'tbsettings', true, function (resp) {
            if (!resp || resp === TBUtils.WIKI_PAGE_UNKNOWN || resp === TBUtils.NO_WIKI_PAGE) {
                return;
            }

            if (TBStorage.domain != 'www') {
                TBui.textFeedback("Cannot import from " + TBStorage.domain + ".reddit.com.");
                $.log("Cannot import from " + TBStorage.domain + ".reddit.com.");
                return;
            }

            if (resp['Utils.lastversion'] < 300) {
                TBui.textFeedback("Cannot import from a toolbox version under 3.0");
                $.log("Cannot import from a toolbox version under 3.0");
                return;
            }

            $.each(resp, function (fullKey, value) {
                var key = fullKey.split(".");

                TBStorage.setSetting(key[0], key[1], value);
            });

            callback();
        });
    };


    // Utility methods
    TBUtils.removeQuotes = function (string) {
        return string.replace(/['"]/g, '');
    };

    TBUtils.stringToColor = function (str) {
        // str to hash
        for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));

        // int/hash to hex
        for (var i = 0, color = "#"; i < 3; color += ("00" + ((hash >> i++ * 8) & 0xFF).toString(16)).slice(-2));

        return color;
    };


    // Added back for MMP's live mod mail.
    TBUtils.compressHTML = function (src) {
        return src.replace(/(\n+|\s+)?&lt;/g, '<').replace(/&gt;(\n+|\s+)?/g, '>').replace(/&amp;/g, '&').replace(/\n/g, '').replace(/child" >  False/, 'child">');
    };


    TBUtils.addToSiteTaable = function (URL, callback) {
        if (!URL || !callback) callback(null);

        $.get(URL, function (resp) {
            if (!resp) callback(null);

            resp = resp.replace(/<script(.|\s)*?\/script>/g, '');
            var $sitetable = $(resp).find('#siteTable');
            $sitetable.find('.nextprev').remove();

            if ($sitetable) {
                callback($sitetable);
            } else {
                callback(null);
            }

        });
    };


    // easy way to simulate the php html encode and decode functions
    TBUtils.htmlEncode = function (value) {
        //create a in-memory div, set it's inner text(which jQuery automatically encodes)
        //then grab the encoded contents back out.  The div never exists on the page.
        return $('<div/>').text(value).html();
    };


    TBUtils.htmlDecode = function (value) {
        return $('<div/>').html(value).text();
    };

    TBUtils.clearCache = function () {
        $.log('TBUtils.clearCache()');

        TBUtils.noteCache = {};
        TBUtils.configCache = {};
        TBUtils.noConfig = [];
        TBUtils.noNotes = [];
        TBUtils.mySubs = [];
        TBUtils.mySubsData = [];

        TBStorage.clearCache();
    };


    TBUtils.getReasonsFromCSS = function (sub, callback) {

        // If not, build a new one, getting the XML from the stylesheet
        $.get('/r/' + sub + '/about/stylesheet.json').success(function (response) {
            if (!response.data) {
                callback(false);
                return;
            }

            // See if this subreddit is configured for leaving reasons using <removalreasons2>
            var match = response.data.stylesheet.replace(/\n+|\s+/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .match(/<removereasons2>.+<\/removereasons2>/i);

            // Try falling back to <removalreasons>
            if (!match) {
                match = response.data.stylesheet.replace(/\n+|\s+/g, ' ')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .match(/<removereasons>.+<\/removereasons>/i);
            }

            // Neither can be found.
            if (!match) {
                callback(false);
                return;
            }

            // Create valid XML from parsed string and convert it to a JSON object.
            var XML = $(match[0]);
            var reasons = [];

            XML.find('reason').each(function () {
                var reason = {
                    text: escape(this.innerHTML)
                };
                reasons.push(reason);
            });

            var oldReasons = {
                pmsubject: XML.find('pmsubject').text() || '',
                logreason: XML.find('logreason').text() || '',
                header: escape(XML.find('header').text() || ''),
                footer: escape(XML.find('footer').text() || ''),
                logsub: XML.find('logsub').text() || '',
                logtitle: XML.find('logtitle').text() || '',
                bantitle: XML.find('bantitle').text() || '',
                getfrom: XML.find('getfrom').text() || '',
                reasons: reasons
            };

            callback(oldReasons);
        }).error(function () {
            callback(false);
        });
    };


    // NER, load more comments, and mod frame support.
    $('div.content').on('DOMNodeInserted', function (e) {
        var $target = $(e.target), $parentNode = $(e.target.parentNode);
        if (!($target.hasClass("sitetable") && ($target.hasClass("listing") || $target.hasClass("linklisting") ||
          $target.hasClass("modactionlisting"))) && !$parentNode.hasClass('morecomments') && !$target.hasClass('flowwit')) return;

        $.log('TBNewThings firing from: ' + $target.attr('class'), false, 'TBUtils');

        // Wait a sec for stuff to load.
        setTimeout(function () {
            var event = new CustomEvent("TBNewThings");
            window.dispatchEvent(event);
        }, 1000);
    });


    window.onbeforeunload = function () {
        // TBUI now handles the long load array.
        if (TBui.longLoadArray.length > 0) {
            return 'Toolbox is still busy!';
        }


        // Cache data.
        TBStorage.setCache('Utils', 'configCache', TBUtils.configCache);
        TBStorage.setCache('Utils', 'noteCache', TBUtils.noteCache);
        TBStorage.setCache('Utils', 'noConfig', TBUtils.noConfig);
        TBStorage.setCache('Utils', 'noNotes', TBUtils.noNotes);
        TBStorage.setCache('Utils', 'moderatedSubs', TBUtils.mySubs);
        TBStorage.setCache('Utils', 'moderatedSubsData', TBUtils.mySubsData);

        // Just in case.
        TBStorage.unloading();


        //localStorage.removeItem(TBStorage.SAFE_STORE_KEY);

        if (TBStorage.bnwShim) {
            localStorage[TBStorage.BNW_SHIM_KEY] = true;
        }
    };


    // get toolbox news
    (function getNotes() {
        TBUtils.readFromWiki('toolbox', 'tbnotes', true, function (resp) {
            if (!resp || resp === TBUtils.WIKI_PAGE_UNKNOWN || resp === TBUtils.NO_WIKI_PAGE || resp.length < 1) return;
            if (resp.stableVerson > TBUtils.shortVersion && TBUtils.browser == 'firefox' && TBUtils.isExtension) {
                TBUtils.alert("There is a new version of Toolbox for Firefox!  Click here to update.", function (clicked) {
                    if (clicked) window.open("//creesch.github.io/reddit-declutter/reddit_mod_tb.xpi");
                });
                return; //don't spam the user with notes until they have the current version.
            }
            $(resp.notes).each(function () {
                TBUtils.showNote(this);
            });
        });

        if (betaRelease) {
            TBUtils.readFromWiki('tb_beta', 'tbnotes', true, function (resp) {
                if (!resp || resp === TBUtils.WIKI_PAGE_UNKNOWN || resp === TBUtils.NO_WIKI_PAGE || resp.length < 1) return;
                $(resp.notes).each(function () {
                    TBUtils.showNote(this);
                });
            });
        }

        //check dev sub, if debugMode
        if (TBUtils.debugMode) {
            TBUtils.readFromWiki('tb_dev', 'tbnotes', true, function (resp) {
                if (!resp || resp === TBUtils.WIKI_PAGE_UNKNOWN || resp === TBUtils.NO_WIKI_PAGE || resp.length < 1) {
                    TBUtils.devMode = false;
                    TBUtils.devModeLock = true;
                    return;
                }

                if (resp.devVersion > TBUtils.shortVersion && TBUtils.isExtension) {
                    TBUtils.alert("There is a new development version of Toolbox!  Click here to update.", function (clicked) {
                        if (clicked) window.open("https://github.com/creesch/reddit-moderator-toolbox");
                    });
                    //return; //do spam?  I donno.
                }
                $(resp.notes).each(function () {
                    TBUtils.showNote(this);
                });
            });
        }
    })();

}(TBUtils = window.TBUtils || {}));
}

(function () {
    // wait for storage
    window.addEventListener("TBStorageLoaded", function () {
        initwrapper();

        var event = new CustomEvent("TBUtilsLoaded");
        window.dispatchEvent(event);
    });
})();
