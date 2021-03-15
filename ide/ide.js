$(function () {
    "use strict";
    
    var worker
    var sourceLines
    var website = 'WEBSERVER_NAME_TEMPLATE' // normally glowscript, transformed by server
    var sandbox_prefix = 'SANDBOX_PREFIX_TEMPLATE' // https://sandbox for production, transformed by server
    var disable_writes = false // prevent all writes (edit, create/delete folder or program, copy/rename program)
    
    window.icons = true // default display of folder contents is the "classic" icon display
    window.names = 'down' // 'down' means A->Z; 'up' means Z->A; '' means ordering by dates
    window.dates = ''     // 'down' means early->late; 'up' means late->early; '''' means ordering by names

    var onNavigate = {
        callbacks: [],
        on: function (callback) { this.callbacks.push(callback) },  // Callback must itself take a callback as a parameter, and call it when it is ready to navigate!
        trigger: function (callback) {
            var cbs = this.callbacks
            this.callbacks = []
            var count = cbs.length
            if (!count)
                callback()
            else
                for (var i = 0; i < cbs.length; i++)
                    cbs[i](function () { if (! --count) callback() })
        }
    }

    function parseVersionHeader( source ) { // null if sourceLines already exists
    	if (source !== null) sourceLines = source.split("\n")
        else source = 'already exists\n'
        var header = sourceLines[0]
        // Remove a newline or similar character at the end of header:
        if (header.charCodeAt(header.length-1) < 32)
            header = header.substring(0,header.length-1)
        var rest = source.substr( sourceLines[0].length+1 )
        var ret = {
            version: null,
            lang: '', // 'vpython' (default) or 'javascript' or a string that is neither (e.g. when editing header)
            source: rest,
            ok: false,
            unpackaged: false,
            isCurrent: false
        }
        header = header.split(" ")
        if (header.length === undefined) return ret
        if (header[0] == ' ') return ret
        var elements = []
        for (var i=0; i<header.length; i++) { // remove empty strings corresponding to spaces
            if (header[i] != '') elements.push(header[i])
        }
    	if (elements.length < 2 || elements.length > 3) return ret
        if (elements[0] != 'GlowScript') return ret
        ret.lang = 'javascript' // the default if no language is specified
        if (elements.length == 3) {
            ret.lang = elements[2].toLowerCase()
            if (!(ret.lang == 'javascript' || ret.lang == 'vpython')) return ret
        }
        var ver = elements[1]
        var okv = parseVersionHeader.okVersions[ver]
        if (okv === undefined) okv = false
        // Prior to version 3.0, we stripped the header line from the source:
        else if (Number(okv) < 3.0) source = source.substr(sourceLines[0].length+1) 
        var unpackaged = (okv === "unpackaged")
        return {
            version: okv,
            lang: ret.lang,
            source: source, 
            ok: okv, 
            unpackaged:unpackaged, 
            isCurrent: okv && (unpackaged || ver==parseVersionHeader.defaultVersion) 
        }
    }
    
    parseVersionHeader.defaultVersion = "3.0"
    parseVersionHeader.defaultHeader = "GlowScript " + parseVersionHeader.defaultVersion+' VPython'
    parseVersionHeader.errorMessage = "GlowScript " + parseVersionHeader.defaultVersion
    // Map each version that can be loaded to a packaged version (usually itself), or "unpackaged" if it is the current development version
    parseVersionHeader.okVersions = {
        __proto__: null,
        "0.3": "0.3",
        "0.4": "0.4",
        "0.5": "0.5",
        "0.6": "0.6",
        "0.7": "0.7",
        "1.0": "1.0",
        "1.1": "1.1",
        "2.0": "2.0",
        "2.1": "2.1",
        "2.2": "2.2",
        "2.3": "2.3",
        "2.4": "2.4",
        "2.5": "2.5",
        "2.6": "2.6",
        "2.7": "2.7",
        "2.8": "2.8",
        "2.9": "2.9",
        "3.0": "3.0",
        "0.4dev" : "0.4",
        "0.5dev" : "0.5",
        "0.6dev" : "0.6",
        "0.7dev" : "0.7",
        "1.0dev" : "1.0",
        "1.1dev" : "1.1",
        "2.0dev" : "2.0",
        "2.1dev" : "2.1",
        "2.2dev" : "2.2",
        "2.3dev" : "2.3",
        "2.4dev" : "2.4",
        "2.5dev" : "2.5",
        "2.6dev" : "2.6",
        "2.7dev" : "2.7",
        "2.8dev" : "2.8",
        "2.9dev" : "2.9",
        "3.0dev" : "3.0",
        "3.1dev" : "unpackaged"
    }

    /******** Functions to talk to the API on the server ***********/
    
    var encode = encodeURIComponent
    var decode = decodeURIComponent
    
    var LIST = ""
    function apiError(message) {
        alert(message)
    }
    function apiURL( route ) {
        if (route.login !== undefined)
            return 'api/login'
        if (route.user !== undefined) {
            var u = "api/user/" + encode(route.user)  // user might be LIST, to get the list
            if (route.folder !== undefined) {
                u += "/folder/" + encode(route.folder)  // folder might be LIST, to get the list
                if (route.program !== undefined) {
                    u += "/program/" + encode(route.program)  // program might be LIST, to get the list
                    if (route.option !== undefined) {
                    	u += "/option/" + route.option
                    	if (route.oldfolder !== undefined) {
                    		u += "/oldfolder/" + route.oldfolder
                    		if (route.oldprogram !== undefined) {
                    			u += "/oldprogram/" + route.oldprogram
                    		}
                    	}
                    }
                }
            }
            return u
        } else {
            (route)
            throw new Error("Unknown API route")
        }
    }
    function apiGet(route, callback) {
        var url = apiURL(route)
        $.ajax({
            type: 'GET',
            url: url,
            dataType: 'json',
            success: callback,
            error: function (xhr, message, exc) {
                apiError("API GET" + message + " getting " + url + ": " + exc)
            }
        })
    }
    function apiPut(route, data, callback) {
        var url = apiURL(route)
        $.ajax({
            type: 'PUT',
            url: url,
            data: { 'program': JSON.stringify(data) },
            headers: { 'X-CSRF-Token': loginStatus.secret },
            dataType: 'text',  // actually nothing?
            success: callback,
            error: function (xhr, message, exc) {
                apiError("API " + message + " saving " + url + ": " + exc)
            }
        })
    }
    function apiDelete(route, callback) {
        var url = apiURL(route)
        $.ajax({
            type: 'DELETE',
            url: url,
            headers: { 'X-CSRF-Token': loginStatus.secret },
            dataType: 'text',
            success: callback,
            error: function (xhr, message, exc) {
                apiError("API " + message + " deleting " + url + ": " + exc)
            }
        })
    }
    function apiCopy(route, callback) { // copy or rename
    	// route = /api/user/username/folder/foldername/program/programname/option/copy or rename/
    	//    oldfolder/oldfoldername/oldprogram/oldprogramname
    	var url = apiURL(route)
        $.ajax({
            type: 'PUT',
            url: url,
            success: callback,
            error: function (xhr, message, exc) {
                apiError("API " + message + " copy or rename " + url + ": " + exc)
            }
        })
    }
    function apiDownload(route, callback) { 
    	// route = /api/user/username/folder/foldername/program/programname/option/download
    	// Slight modifications here and in api.py could handle options other than download
    	var url = apiURL(route)
        $.ajax({
            type: 'GET',
            url: url,
            success: callback,
            error: function (xhr, message, exc) {
                apiError("API " + message + " downloading " + url + ": " + exc)
            }
        })
    }
    
    function apiExists(route, callback) {
        var url = apiURL(route)
        $.ajax({
            type: 'GET',
            url: url,
            dataType: 'json',
            success: function() { callback(true) },
            error: function (xhr, message, exc) {
                if (xhr.status == 404) 
                    callback(false)
                else
                    apiError("API Exists " + message + " getting " + url + ": " + exc)
            }
        })
    }
    var folderList = null
    function getFolderList(username, callback) {
        if (folderList) callback(folderList)
        apiGet({user:username, folder:LIST}, function (nfl) { folderList = nfl; callback(nfl); })
    }
    function saver(uri, getProgramSource, setStatus) {
        var saveTimeout = null
        var saving = false
        var savingSource = getProgramSource()
        var saveDelay
        var onSavedCallback

        function saveNow() {
            if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
            if (saving) return
            saving = true
            savingSource = getProgramSource()
            var save = { 
                source: savingSource
                //description: ""  // not currently used
            }

            // description is not currently used
            //var descriptionCommentMatch = savingSource.match(/^(?:GlowScript.*\r?\n|#.*\r?\n|\r?\n)*\/\*([^\x00]*?)\*\//)
            //if (descriptionCommentMatch) save.description = descriptionCommentMatch[1]

            setStatus("Saving...")
            apiPut(uri, save, saved)
        }

        function saved() {
            saving = false
            // If there's been another change, do another delayed save
            if (getProgramSource() !== savingSource)
                saveAfter(saveDelay)
            else {
                setStatus("Saved")
                if (onSavedCallback) onSavedCallback()
            }
        }

        function saveAfter(ms, onSaved) {
            if (!saving && getProgramSource() === savingSource) {
                if (onSaved) onSaved()
                return
            }

            setStatus("Modified")
            saveDelay = ms
            onSavedCallback = onSaved
            if (saveTimeout) clearTimeout(saveTimeout)
            saveTimeout = setTimeout(saveNow, saveDelay)
        }

        return saveAfter
    }
    var loginStatus = window.loginStatus = { 'state': 'checking' }
    // For now, we need to get login status before doing anything else.  Ideally we would
    // do this in parallel with loading other page information, but not display pages that
    // care about login status until this is ready.
    onNavigate.on( getLoginStatus )
    function getLoginStatus( cb ) {
        apiGet({login:1}, function(stat) {
            onLoginStatusChange(stat)
            cb() 
        })
    }
    function onLoginStatusChange(stat) {
        // Startup sequence: Call onhashchange, which executes onNavigate.trigger, 
        // which calls getLoginStatus due to onNavigate.on( getLoginStatus ),
        // which calls onLoginStatusChange with one of these two arguments:
        // stat = {state: "not_logged_in", login_url: "/_ah/login?continue=http%3A//localhost%3A8080/%23/action/loggedin"}
        // stat = {username: "test", state: "logged_in", secret: "qwie9Mnddk0zYnz3Qxov7g==", 
        //              logout_url: "/_ah/login?continue=http%3A//localhost%3A8080/%23/action/loggedout&action=Logout"}
        if (stat === null) {  // Apparently timing issues can lead to stat === null at startup
            stat = {'state': 'checking'}
            window.onhashchange() // try again
        }
        loginStatus = stat
        if (loginStatus.username) loginStatus.username = decode(loginStatus.username)

        var $userstatus = $(".userstatus")
        $userstatus.addClass("template")

        var $activestatus = $userstatus.filter("." + loginStatus.state)
        $activestatus.removeClass("template")

        // For now, we use the login and logout urls directly (we don't frame them or anything).  After signing in/out, they
        // redirect back to /#/action/something, and the actionPage handler below will pop state back to this page (which will
        // be reloaded)
        
        if (loginStatus.state == "not_logged_in") {
            $activestatus.find(".signin").prop("href", loginStatus.login_url)
            //click(function (ev) { tryLogin(); ev.preventDefault(); return false; })
        }
        else if (loginStatus.state == "logged_in") {
            $activestatus.find(".signout").prop("href", loginStatus.logout_url)
            $activestatus.find(".signedin_user").text(loginStatus.username)
            $activestatus.find(".signedin_user_link").prop( "href", unroute({page:"user", user:loginStatus.username}) )
        }
        else if (loginStatus.state == "new_user") {
            var $dialog = $("#newUser-dialog").clone().removeClass("template")
            var $name = $dialog.find('input[name="name"]')

            // Real-time validation for the name field
            var changeTimeout
            $name.on('textchange', function (event, previousText) {
                $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)").button("disable")
                $name.removeClass("ui-state-error")
                $dialog.find(".validateTips").text("").removeClass("ui-state-highlight")
                clearTimeout(changeTimeout)
                function err(msg) {
                    $name.addClass("ui-state-error")
                    $dialog.find(".validateTips").text(msg).addClass("ui-state-highlight")
                }
                var val = $name.val()
                if (val == "")
                    err("You must specify a name.")
                // Instead of listing what characters are not legal, list those that are.
                // else if (!val.match(new RegExp("^[^/@<>&%]+$"))) // old scheme
                else if (val.match(new RegExp("[^a-z^A-Z^0-9^\x20^\x2d^\x2e^\x5f]")))
                    err( "Name must contain only letters, digits, spaces, hyphens, periods, or underscores." )
                else
                    changeTimeout = setTimeout( function() {
                        if ($name.val() != val) return;
                        apiExists( {user:val}, function( isPresent ) {
                            if (val != $name.val()) return
                            if (isPresent) err("This name is already in use.")
                            else $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)").button("enable")
                        })
                    }, 500)
            })

            $name.val(loginStatus.suggested_name)
            $name.trigger("textchange")

            $dialog.dialog({
                width: 300,
                modal: true,
                autoOpen: true,
                buttons: {
                    "OK": function () {
                        var $this = $(this)
                        var name = $name.val()
                        apiExists( {user:name}, function( isPresent ) {
                            if (!isPresent) {
                                apiPut( {user:name}, {}, function (stat) {
                                    $this.dialog("close")
                                    apiGet( {login:1}, function(stat) {
                                        onLoginStatusChange(stat)
                                    })
                                })
                            } else {
                                alert("This name is already in use.")
                            }
                        })
                    },
                    //"Cancel": function () { $(this).dialog("close"); }
                },
                close: function () { }
            }).submit(function(ev){
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)")
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            })
        }
    }

    /********** Router *********/

    function router() {
        // This takes the "virtual url" from the hash portion of window.location and turns it into a "route" structure, e.g.
        //   { page:"edit", user:"Me", folder:"My Programs", program:"Some Program" }

        // For readability, our virtual urls are escaped in a nonstandard way.  Spaces are represented by _, and slashes
        //   are not representable (even escaped).  % and _ are escaped using percent encoding.  Non-ascii characters are NOT escaped.
    	// Later (2014?): There were problems with this scheme, and now spaces etc. are not allowed in names of entities.
    	
    	var h = (location.hash || "#").substr(1)

        var components = h.split("/")
        for(var i=0; i<components.length; i++) {
            components[i] = decode( components[i].replace(/_/g, " ") )
            if (components[i].indexOf("/") >= 0)
                return { page: "error", error: "404 Not Found.  The URL appears to be incorrect." }
        }
        h = components.join("/")

        var m
        if (h == "" || h == "/") return { page: "welcome" }
        m = h.match(new RegExp("/user/([^/]+)/folder/([^/]+)/program/([^/]+)/edit$"))
        if (m) return { page: "edit", user: m[1], folder: m[2], program: m[3] }
        m = h.match(new RegExp("/user/([^/]+)/folder/([^/]+)/program/([^/]+)/share$"))
        if (m) return { page: "share", user: m[1], folder: m[2], program: m[3] }
        m = h.match(new RegExp("/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)"))
        if (m) return { page: m[4], user: m[1], folder: m[2], program: m[3], option:m[4] }
        m = h.match(new RegExp("/user/([^/]+)/folder/([^/]+)/program/([^/]+)$"))
        if (m) return { page: "run", user: m[1], folder: m[2], program: m[3] }
        m = h.match(new RegExp("/user/([^/]+)/folder/([^/]+)/$"))
        if (m) return { page: "folder", user: m[1], folder: m[2] }
        m = h.match(new RegExp("/user/([^/]+)/$"))
        if (m) return { page: "user", user: m[1] }
        m = h.match(new RegExp("/action/([^/]+)$"))
        if (m) return { page: "action", action: m[1] }
        return { page: "error", error: "404 Not Found.  The URL appears to be incorrect." }
    }
    function unroute(route, ext) {
        // Reverses what router() does, returning a URI (starting with #)
        if (ext) route = $.extend({}, route, ext)
        var h = "#/"
        if (route.page=="welcome") return h
        if (route.page=="action") return h+e(route.action)
        if (route.user) {
            h += "user/" + e(route.user) + "/"
            if (route.page == "user") return h
            if (route.folder) {
                h += "folder/" + e(route.folder) + "/"
                if (route.page == "folder") return h
                if (route.program) {
                    h += "program/" + e(route.program)
                    if (route.page == "run") return h
                    if (route.page == "downloadFolder") return h + "/option/" + e(route.page)
                    if (route.page == "downloadProgram") return h + "/option/" + e(route.page)
                    if (route.page == "share" || route.page == "edit") return h + "/" + e(route.page)
                }
            }
        }
        (route)
        throw new Error("unroute: Invalid route")

        function e(str) {
            return str.replace(/%/g,"%25").replace(/_/g,"%5f").replace(/ /g,"_")
        }
    }
    var pages = {}
    function navigate(uri) {
        if (uri.page) uri = unroute(uri)
        if (window.history.pushState)
            window.history.pushState(null, null, uri)
        else
            window.location = uri
        window.onhashchange()
    }
    function redirect(uri) {
        if (uri.page) uri = unroute(uri)
        if (window.history.replaceState)
            window.history.replaceState(null, null, uri)
        else
            window.location = uri
        window.onhashchange()
    }
    window.ideNavigate = navigate
    var navigatingTo = null
    window.onhashchange = function () {
        navigatingTo = router()
        onNavigate.trigger( function() { pages[ navigatingTo.page ]( navigatingTo ) } )
    }

    var d = new Date()
    var hour_offset = d.getTimezoneOffset()/60
    var minute_offset, f
    if (hour_offset >= 0) {
        f = Math.floor(hour_offset)
    } else {
        f = -Math.floor(-hour_offset)
    }
    minute_offset = 60*(hour_offset - f)
    hour_offset = f
    
    function date_to_string(t) {
    	if (t != 'None') {
        	// prog.datetime is UTC; here we convert to local time for display purposes
        	var patt = new RegExp('(\\d*)-(\\d*)-(\\d*)\\s(\\d*):(\\d*):(\\d*[.]*\\d*)')
            var m = patt.exec(t)
        	var year = Number(m[1])
        	var month = Number(m[2])
        	var day = Number(m[3])
        	var hour = Number(m[4])
        	var minute = Number(m[5])
        	var second = Math.floor(Number(m[6]))
        	
        	d.setUTCSeconds(second)
        	d.setUTCMinutes(minute-minute_offset)
        	d.setUTCHours(hour-hour_offset) // UTC to local time
        	d.setUTCDate(day)
        	d.setUTCMonth(month-1) // JavaScript numbers months starting at zero
        	d.setUTCFullYear(year)        	
        	
        	year = d.getUTCFullYear()
        	month = Number(d.getUTCMonth())+1 // restore original 1-12 month number
        	day = d.getUTCDate()
        	hour = d.getUTCHours()
        	minute = d.getUTCMinutes()
        	second = d.getUTCSeconds()
        	if (month < 10) month = '0'+month
        	if (day < 10) day = '0'+day
        	if (hour < 10) hour = '0'+hour
        	if (minute < 10) minute = '0'+minute
        	if (second < 10) second = '0'+second
        	t = year+'/'+month+'/'+day+' '+hour+':'+minute+':'+second
        } else t = 'Before 2018'
        return t
    }

    /********** Pages **********/
    // Each of these replaces pageBody with the contents of a page
    var pageBody = $("#ajaxBody")
    pages.redirect = function(route) { redirect(route.target) }
    pages.error = function(route) {
        pageBody.html($("<p/>").addClass("errorText").text(route.error))
    }
    pages.welcome = function(route) {
        var $page = $(".welcomePage.template").clone().removeClass("template")
        pageBody.html($page)
    }
    pages.user = function(route) {
        // Redirect to a default folder.  For now, this is the first folder in the list of folders for the user
        apiGet( {user:route.user, folder:LIST}, function (data) {
            route.folder = decode(data.folders[0])
            route.page = "folder"
            redirect( route )
        })
    }
    pages.action = function(route) {
        redirect( {page: "welcome"} )
    }
    pages.downloadFolder = function(route) { // Currently the only program option is download (download a program to user computer) // Currently the only program option is download (download a program to user computer)
        apiDownload( {user:route.user, folder:route.folder, program:'program', option:'downloadFolder'}, function(ret) {
    		window.location = apiURL(route) // this sends the file to the user's download folder
        	navigate(unroute(route, {page:"folder"})) // return to (stay on) folder page
        })
    }

    pages.folder = function (route) {
        let username = route.user, folder = route.folder
        let isWritable = route.user === loginStatus.username
        if (disable_writes) isWritable = false

        let page = $(".folderPage.template").clone().removeClass("template")
        let programTemplate = page.find(".program.template")
        let programUpdownTemplate = page.find(".up-down.template")
        let programDetailsTemplate = page.find(".program-details.template")
        let folderTemplate = page.find(".folderListItem.template")

        if (!isWritable) {
            page.find(".folder-public.button").addClass("template")
            page.find(".program-new.button").addClass("template")
            page.find(".folder-new-tab").addClass("template")
        }

    	page.find(".username").text(username) // + ", IDE jQuery ver. " + jQuery.fn.jquery) // To show IDE jQuery version number at top of IDE during run.
        page.find(".foldername").text(folder)
        page.find(".folder-download.button").prop("href", unroute({page:"downloadFolder", user:username, program:'program', folder:folder}))
        pageBody.html(page)

        function folderPublicPrivate(templ, name, pub, action) { // dialog for toggling folder to be PUBLIC or PRIVATE
            let title = pub ? 'PRIVATE' : 'PUBLIC'
            let $dialog = $(templ).clone().removeClass("template")
            $dialog.find(".public-private").text(title)
            $dialog.dialog({
                width: "300px",
                modal: true,
                autoOpen: true,
                buttons: {
                    "Yes": function () {
                        $(this).dialog("close")
                        action()
                    },
                    "Cancel": function () { $(this).dialog("close") }
                }
            }).submit(function(ev){
                let $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)")
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            })
            return false
        }

        function createDialog( templ, doCreate ) {
            // dialog for creating a new program (temp1 == '#prog-new-dialog') or a new folder (temp1 == '#folder-new-dialog')
            var $dialog = $(templ).clone().removeClass("template")
            $dialog.dialog({
                width: 300,
                resizable: false,
                modal: true,
                autoOpen: true,
                buttons: {
                    "Create": function () {
                        doCreate($(this))
                        $(this).dialog("close")
                    },
                    "Cancel": function () { $(this).dialog("close") }
                },
                close: function () {  }
            }).submit(function(ev){
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)")
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            })
        }
    	
        function copyOrRename(dialog, oldfolder, oldname) { // copy or rename a program
            renameDialog(dialog, oldname, function($dlg) {
                var newname = $dlg.find('input[name="name"]').val()
                newname = newname.replace(/ /g,'') // There are problems with spaces or underscores in names
                newname = newname.replace(/_/g,'')
                var newfolder = oldfolder
                var folder_name = newname.split('/')
                if (folder_name.length == 2) {
                	newfolder = folder_name[0]
                	newname = folder_name[1]
                } else if (folder_name.length > 2) {
                	alert(newname+' is not a legal program name')
                	return false
                }
                if (newfolder === oldfolder && newname === oldname) return false // no change
                var ok = ( newfolder in set_of_folders )
                if (!ok) alert('There is no folder named "'+newfolder+'"')
                else {
                	// check whether there already exists newfolder/newname
                	apiGet( {user:username, folder:newfolder, program:LIST}, function (data) {
                		for (var pi=0; pi<data.programs.length; pi++) {
                			if (data.programs[pi].name === newname) {
                				ok = false
                				break
                			}
                		}
                        if (!ok) alert("The program "+newfolder+'/'+newname+" already exists.")
                        else { // At this point we know that newfolder/newname is an okay destination for the renaming
                        	var option = 'copy'
                        	if (dialog == "#prog-rename-dialog") option = 'rename'
                        	apiCopy({user:username, folder:newfolder, program:newname,
                        		option:option, oldfolder:oldfolder, oldprogram:oldname}, 
                        		function () {
                        			navigate({page: "folder", user:username, folder:oldfolder})
	                        })
                        }
                	})
                }
            })
            return false
        }

        pages.downloadFolder = function(route) { // Currently the only program option is download (download a program to user computer)
            apiDownload( {user:route.user, folder:route.folder, program:'program', option:'downloadFolder'}, function(ret) {
        		window.location = apiURL(route) // this sends the file to the user's download folder
            	navigate(unroute(route, {page:"folder"})) // return to (stay on) folder page
            })
        }
        
        function renameDialog( dialog, oldname, doRename ) {
        	// dialog for renaming/copying a program (can include moving to another folder)
        	var args =	{
        		width: 300,
                resizable: false,
                modal: true,
                autoOpen: true,
                close: function () {  }
        		}
        	if (dialog == "#prog-copy-dialog") {
                args.buttons = {
                    "Copy": function () {
                        doRename($(this))
                        $(this).dialog("close")
                    }
                }
        	} else {
                args.buttons = {
                    "Rename": function () {
                        doRename($(this))
                        $(this).dialog("close")
                    }
                }
        	}
        	args.buttons["Cancel"] = function () { $(this).dialog("close") }
        	var $dialog = $(dialog).clone().removeClass("template")
            $dialog.find(".name").text(oldname)
            if (dialog == "#prog-copy-dialog")
            	$dialog.find(".copy-default").val(oldname)
            else
            	$dialog.find(".rename-default").val(oldname)
            $dialog.dialog(args).submit(function(ev){
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)")
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            })
    	}

        function delProgramOrFolder(templ, name, action) { // dialog for deleting a program or folder (folder must be empty to delete a folder)
            var $dialog = $(templ).clone().removeClass("template")
            if (!name) return
            $dialog.find(".name").text(name)
            $dialog.dialog({
                width: "300px",
                modal: true,
                autoOpen: true,
                buttons: {
                    "Delete": function () {
                        $(this).dialog("close")
                        action()
                    },
                    "Cancel": function () { $(this).dialog("close") }
                }
            }).submit(function(ev){
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)")
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            })
            return false
        }

        page.find(".folder-new").click(function (ev) { // create a new folder
            ev.preventDefault()
            createDialog("#folder-new-dialog", function($dlg) {
                var name = $dlg.find('input[name="name"]').val()
                if (name == 'Add Folder') return false
                name = name.replace(/ /g,'') // There are problems with spaces or underscores in names
                name = name.replace(/_/g,'')
                var temp = name.search(':')
                if (temp >= 0) {
                	alert('A folder name cannot contain ":".')
                	return false
                }
                temp = name.split('/')
                if (temp.length > 1) {
                	alert('A folder name cannot contain "/".')
                	return false
                }
                if (name in set_of_folders) {
                    alert('There already exists a folder named "'+name+'"')
                    return false
                }
                var p = $dlg.find('input[name="isPublic"]').is(":checked") // true is checked, which means public
                apiPut({user:username, folder:name}, {public:p}, function () {
                    navigate( {page:"folder", user:username, folder:name} )
                })
            })
            return false
        })

        page.find(".folder-delete").click(function (ev) { // delete a folder (must be an empty folder)
            ev.preventDefault()
            return delProgramOrFolder("#folder-delete-dialog", folder, function() {
                apiDelete( {user:username, folder:folder}, function () {
                    navigate( {page:"user", user:username} )                
                })                
            })
        })

        page.find(".program-new").click(function (ev) { // create a new program
            ev.preventDefault()
            createDialog("#prog-new-dialog", function($dlg) {
                var name = $dlg.find('input[name="name"]').val()
                name = name.replace(/ /g,'') // There are problems with spaces or underscores in names
                name = name.replace(/_/g,'')
                var temp = name.search(':')
                if (temp >= 0) {
                	alert('A program name cannot contain ":".')
                	return false
                }
                temp = name.split('/')
                if (temp.length > 1) {
                	alert('A program name cannot contain "/".')
                	return false
                }
                var ok = true
                apiGet( {user:username, folder:folder, program:LIST}, function (data) {
                    for (var pi=0; pi<data.programs.length; pi++) {
                        if (data.programs[pi].name === name) {
                            ok = false
                            alert('There already exists a program named "'+name+'"')
                            break
                        }
                    }
                    if (ok) {
                        apiPut({user:username, folder:folder, program:name}, { source: parseVersionHeader.defaultHeader+"\n" }, function () {
                            navigate({page:"edit", user:username, folder:folder, program:name})
                        })
                    }
                })
            })
            return false
        })        

        page.find(".folder-public").click(function(ev) { // toggle PUBLIC/PRIVATE for a folder
            ev.preventDefault()
            let pub = set_of_folders[folder]
            return folderPublicPrivate("#public-dialog", folder, pub, function() {
                apiPut({user:username, folder:folder}, {public:!pub}, function () {
                    navigate( {page:"folder", user:username, folder:folder} )
                })
            })
        })

        page.find(".folder-listing").click(function(ev) { // toggle Icons/List for a folder
            ev.preventDefault()
            window.icons = !window.icons
            navigate({page: "folder", user:username, folder:folder})
        })

        // Get a list of folders.  May return multiple times if list is updated
        var set_of_folders = {} // {folder_name : isPublic, ..... }
        getFolderList(username, function (data) {
            page.find(".folderList > .templated").remove()
            var before = folderTemplate.next()
            var folders = data.folders
            var publics = data.publics
            for (var i = 0; i < folders.length; i++) {
                var h = folderTemplate.clone().removeClass("template").addClass("templated")
                var name = decode(folders[i])
                set_of_folders[name] = publics[i]
                if (name == folder) h.addClass("ui-tabs-active").addClass("ui-state-active")
                h.find(".folder-name").text(name).prop("href", unroute({page:"folder", user:username, folder:name}))
                h.insertBefore(before)
            }
            var s = "PRIVATE"
            var pub = set_of_folders[folder] // will be null if folder predates the PRIVATE option
            if (pub === null || pub === true) s = "PUBLIC"
            page.find(".folder-public.button").text(s)
            s = window.icons ? "Icons" : "List"
            page.find(".folder-listing").text(s)
        })
        	
        // Get a list of programs from the server
        apiGet( {user:username, folder:folder, program:LIST}, function (data) {
        	if ("error" in data)
        		alert(data.error)
        	else {
                let progList = page.find(".programs")
                let programs = data.programs // sent from server, an alphabetized list of objects: {name, datetime, snapshot}

                if (programs.length == 0) {
                    page.find(".folder-download.button").addClass("template")
                    if (isWritable) page.find(".folder-delete").removeClass("template")
                    else page.find(".folder-delete").addClass("template")
                } else page.find(".folder-download.button").prop("href", unroute({page:"downloadFolder", user:username, program:'program', folder:folder}))

                if (!window.icons) { // List, ordered by name or date
                    page.find(".prog-separator").html('<br>') // need extra <br> with ordered list

                    // Set up names that looks like this: {AtomicSolid:0, Billboarding:1, BinaryStar:2, Bounce:3}
                    // This is used to access the position in the programs list of {name, datetime, snapshot}
                    let namelinks = {}
                    let names = []
                    let i = 0
                    for (const pr of programs) {
                        if (pr.datetime == 'None') pr.datetime = '2017-01-02 00:00:00.000000'
                        namelinks[pr.name] = i // tie location in programs to the program name
                        names.push(i)
                        i++
                    }
                    let inverse_names = []
                    for (let n=names.length-1; n>=0; n--) inverse_names.push(names[n])

                    // Set up datetimes whose entries look like this: '2020-10-22 15:46:30.101000?AtomicSolid'.
                    // These entries are sorted to time-order the programs.
                    let datetimes = []
                    for (const pr of programs) datetimes.push(pr.datetime+'?'+pr.name)
                    datetimes.sort() // now ordered oldest to newest
                    let dates = [] // oldest to newest program; index into programs
                    for (const pr of datetimes) {
                        let q = pr.indexOf('?')
                        dates.push(namelinks[pr.slice(q+1)]) // programs ordered oldest to newest
                    }
                    let inverse_dates = [] // newest to oldest program; index into programs
                    for (let n=dates.length-1; n>=0; n--) inverse_dates.push(dates[n])

                    let p = programUpdownTemplate.clone().removeClass("template")
                    let listing
                    if (window.names == 'down') {
                        p.find(".updown-names").text('Names ˅') // up/down markers:  ˄   ˅
                        listing = names
                    } else if (window.names == 'up') {
                        p.find(".updown-names").text('Names ˄')
                        listing = inverse_names
                    } else if (window.names == '') {
                        p.find(".updown-names").text('Names')
                    }
                    if (window.dates == 'down') {
                        p.find(".updown-dates").text('Dates ˅')
                        listing = dates
                    } else if (window.dates == 'up') {
                        p.find(".updown-dates").text('Dates ˄')
                        listing = inverse_dates
                    } else if (window.dates == '') {
                        p.find(".updown-dates").text('Dates')
                    }
                    
                    p.find(".updown-names.button").click(function (ev) { // toggle sorting of program names
                        ev.preventDefault()
                        if (window.names == 'down') {
                            window.names = 'up'
                        } else if (window.names == 'up' || window.dates != '') {
                            window.names = 'down'
                            window.dates = ''
                        }
                        navigate(unroute(route, {page:"folder"})) // return to (stay on) folder page
                    })
                    
                    p.find(".updown-dates.button").click(function (ev) { // toggle sorting of program last-edited dates
                        ev.preventDefault()
                        if (window.dates == 'down') {
                            window.dates = 'up'
                        } else if (window.dates == 'up' || window.names != '') {
                            window.dates = 'down'
                            window.names = ''
                        }
                        navigate(unroute(route, {page:"folder"})) // return to (stay on) folder page
                    })

                    progList.append(p)
                    
                    for (const i of listing) {
                        let prog = programs[i]
                        p = programDetailsTemplate.clone().removeClass("template")
                        let name = decode(prog.name)
                        let proute = { user:username, folder:folder, program:name }
                        p.find(".prog-details-run.button").prop("href", unroute(proute, {page:"run"}))
                        p.find(".prog-details-name").text(name)
                        p.find(".prog-details-name.button").prop("href", unroute(proute, {page:"edit"}))
                        let td = date_to_string(prog.datetime) // format 2017-12-21 11:25:31.776000, or 'None'; this is UTC time; needs adjusting to display local time
                        let minute = td.slice(-5,-3)
                        p.find(".prog-details-datetime").text(td.slice(0,-5)+minute) // ignore the seconds
                        
                        p.find(".prog-details-copy.button").click(function (ev) { // COPY a file (can specify folder/file to move to different folder)
                            ev.preventDefault()
                            copyOrRename("#prog-copy-dialog", folder, name)
                        })
                        
                        p.find(".prog-details-rename.button").click(function (ev) { // RENAME a file (can specify folder/file to move to different folder)
                            ev.preventDefault()
                            copyOrRename("#prog-rename-dialog", folder, name)
                        })
                        
                        p.find(".prog-details-delete.button").click(function (ev) { 
                            ev.preventDefault()
                            return delProgramOrFolder("#prog-delete-dialog", name, function() {
                                apiDelete( {user:username, folder:folder, program: name}, function () {
                                    navigate({page: "folder", user:username, folder:folder})
                                })
                            })
                        })
                        progList.append(p)
                    }
                } else {// "Classic" icon-based listing of programs
                    for (const prog of programs) { 
                        let p = programTemplate.clone().removeClass("template")
                        let name = decode(prog.name)
                        let proute = { user:username, folder:folder, program:name }
                        p.find(".prog-name").text(name)
                        let td = date_to_string(prog.datetime) // format 2017-12-21 11:25:31.776000, or 'None'; this is UTC time; needs adjusting to display local time
                        p.find(".prog-datetime").text(td)
                        p.find(".prog-run.button").prop("href", unroute(proute, {page:"run"}))
                        p.find(".prog-edit.button").prop("href", unroute(proute, {page:"edit"}))
        
                        if (!isWritable) {
                            p.find(".prog-edit.button").text("View")
                            p.find(".prog-copy.button").addClass("template")
                            p.find(".prog-rename.button").addClass("template")
                            p.find(".prog-delete.button").addClass("template")
                        }
                        
                        p.find(".prog-copy.button").click(function (ev) { // COPY a file (can specify folder/file to move to different folder)
                            ev.preventDefault()
                            copyOrRename("#prog-copy-dialog", folder, name)
                        })
                        
                        p.find(".prog-rename.button").click(function (ev) { // RENAME a file (can specify folder/file to move to different folder)
                            ev.preventDefault()
                            copyOrRename("#prog-rename-dialog", folder, name)
                        })
                        
                        p.find(".prog-delete.button").click(function (ev) { 
                            ev.preventDefault()
                            return delProgramOrFolder("#prog-delete-dialog", name, function() {
                                apiDelete( {user:username, folder:folder, program: name}, function () {
                                    navigate({page: "folder", user:username, folder:folder})
                                })
                            })
                        })
                        if (prog.screenshot) {
                            p.find(".prog-screenshot").prop("src", prog.screenshot)
                            p.find(".prog-screenshot").click(function (ev) {
                                ev.preventDefault()
                                window.location.href = unroute(proute, {page:"run"})
                            })
                        }
                        progList.append(p)
                    }
                }
            }
        })
    }
    pages.run = function(route) {
        try {
            var username = route.user, folder = route.folder, program = route.program
            var isWritable = route.user === loginStatus.username
            if (disable_writes) isWritable = false

            var page = $(".runPage.template").clone().removeClass("template")
            page.find("a.username").prop("href", unroute(route, {page:"user"}))
            page.find(".username").text(username)
            page.find(".foldername").text(folder)
            page.find(".programname").text(program) // + ", IDE jQuery ver. " + jQuery.fn.jquery) // To show IDE jQuery version number at top of IDE during run.
            page.find(".prog-edit.button").prop("href", unroute(route, {page:"edit"}))
            if (isWritable) page.find(".prog-edit.button").text('Edit this program')
            else page.find(".prog-edit.button").text('View this program')
            pageBody.html(page)

            // Validate that the browser supports Object.defineProperty (not ie8)
            Object.defineProperty({}, "foo", {get: function() { return "bar" }})

            // The user program is "sandboxed" in an iframe with a different origin domain, so that it can't mess with the rest of the site or
            // abuse the user's credentials with our API.  That's important because one logged-in user may be running a different user's program!
            // When this page is served from localhost, we run the iframe from the same origin (not having access to another web server, and not being concerned about security)

            var sandbox_suffix = website
            if (sandbox_suffix.slice(0,4) == 'www.') {
                sandbox_suffix = sandbox_suffix.slice(4)
            }
            var untrusted_origin = sandbox_prefix + sandbox_suffix
            var untrusted_src = untrusted_origin + "/untrusted/run.html"
            var ready = false
            
            try {
                if (localStorage.dev) {
                    untrusted_origin = "http://" + localStorage.dev
                    untrusted_src = untrusted_origin + "/untrusted/run.html"
            
                    var NotRunningTheDevServerTimeout = setTimeout( function() {
                        if (!ready)
                            alert("You have configured "+website+" to load files from '" + untrusted_origin + "', but that server is apparently not responding.  Try setting localStorage.dev='' in the console.")
                    }, 5000)
                    onNavigate.on(function(cb) { clearTimeout(NotRunningTheDevServerTimeout); cb() })
                } else if (document.domain == "localhost") {
                    untrusted_origin = "http://" + window.location.host
                    untrusted_src = "/untrusted/run.html"
                }
            } catch (err) {
                window.console && console.log("Error checking for developer-only settings: ", err)
            }

            var untrusted_frame = page.find("iframe.untrusted-frame")
            var unsentMessages = []
            $(window).on("message", receiveMessage)
            $(document).keydown( sendEvent )
            $(document).keyup( sendEvent )

            onNavigate.on(function (cb) {
                $(document).off( "keydown", sendEvent )
                $(document).off( "keyup", sendEvent )
                $(window).off("message", receiveMessage)
                cb() 
            })

            untrusted_frame.prop("src", untrusted_src)  // Start loading the run script while we wait for the program...

            var $dialog = null
            onNavigate.on( checkDialog )

            var haveScreenshot = true
            apiGet( {user:username, folder:folder, program:program}, function (progData) {
            	if ("error" in progData) {
            		alert(progData.error)
            	} else {
	            	page.find(".prog-datetime").text(date_to_string(progData.datetime))
	                var header = parseVersionHeader( progData.source )
	                if (header.ok) {
	                    haveScreenshot = progData.screenshot != ""
	                    sendMessage(JSON.stringify({ program: header.source, version: header.version, lang: header.lang, unpackaged: header.unpackaged, autoscreenshot:isWritable && !haveScreenshot }))
	                } else {
	                    if ($dialog) $dialog.dialog("close")
	                    $dialog = $("#version-error-dialog").clone().removeClass("template")
	                        .find(".desired-version").text(parseVersionHeader.errorMessage).end()
	                        .dialog({ width: "600px", autoOpen: true });
	                }
            	}
            })
        } catch (err) {
            console.log('pages.run catch', err)
            window.console && console.log("Error: ", err)
            alert("There was an error trying to run the program.")
        }

        function checkDialog(cb) {
            if ($dialog) {
                if (navigatingTo.program !== program || navigatingTo.page == "run") {
                    $dialog.dialog("close")
                } else {
                    // Keep the dialog on this page, but check again at the next transition
                    onNavigate.on( checkDialog )
                }
            }
            cb()
        }

        function screenshot(ev) {
            sendMessage(JSON.stringify({ screenshot: true }))
            ev.preventDefault()
        }

        function sendEvent(ev) {
            // Forward some key events to the iframe, since otherwise it might not get them depending on focus
            // TODO: This is far from perfect.  The iframe receives many events twice, the right context menu is not blocked
            // when a right-spin drag begins inside the iframe but ends outside, not all event data is forwarded, etc.
            if (ev.type == "keydown" || ev.type == "keyup") ev = { type:ev.type, which:ev.which }
            else return;
            if (ready)
                sendMessage( JSON.stringify({event: ev}) )
        }
        // Wrapper for postMessage that queues messages while the iframe initializes
        function sendMessage(message) {
            if (unsentMessages === null)
                untrusted_frame.get(0).contentWindow.postMessage(message, untrusted_origin)
            else
                unsentMessages.push(message)
        }
        function findLine(line,w) {
            // w.indent is the indentation of javascript code by the GlowScript wrapping.
            var indent = w.indent+' ' // Error messages indent an additional space
            indent = new RegExp('^'+indent)
            line = line.replace(indent, '')
            var match = '', best = null, test
            for (var n=0; n<sourceLines.length; n++) {
                // Compiler changes "var a = 10" -> "a = 10" (with "var a" placed at top of program):
                test = sourceLines[n].replace(/^var\s*/, '') 
                for (var i=0; i<line.length; i++) {
                    if (i >= test.length) break
                    var c = line.charAt(i), t = test.charAt(i)
                    if (c != t) break
                }
                if (i > match.length) {
                    match = test.substring(0,i)
                    best = n
                }
            }
            return best+1
        }
        function insertLineNumbers(errline) { // simplifed version of the same routine in compiler.js
            var lines = sourceLines
            var comment = false
            var lineno = 0
            for (var n=2; n<lines.length-1; n++) {
                var m = lines[n].match(/^\s*(.*)/)
                var line = m[1]
                if (line.substr(0,3) == '###') {
                    comment = !comment
                    continue
                }
                if (comment) continue
                if (line.length == 0 || line.charAt(0) == '#') continue
                lineno += 3
                if (lineno >= (errline-2)) return n
            }
            return -1
        }
        function receiveMessage(event) {
            event = event.originalEvent // originalEvent is a jquery entity
            // CAREFUL: We can't trust this data - it could be malicious! Incautiously splicing it into HTML could be deadly.
            if (event.origin !== untrusted_origin) return // check the origin
            var message = JSON.parse(event.data)
                
            // Angus Croll: javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
            // {...} "object"; [...] "array"; new Date "date"; /.../ "regexp"; Math "math"; JSON "json";
            // Number "number"; String "string"; Boolean "boolean"; new ReferenceError) "error"
            var toType = function(obj) {
                return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
            }

            if (!ready) { // first-time message from run.js; check that first-time message content is {ready:true}
                if (toType(message) != 'object') return
                if (message.ready === undefined) return
                if (message.ready !== true) return
                delete message.ready
                for (var m in message) return // message should now be empty; if not, return
                ready = true
                if (unsentMessages !== null) {
                    var um = unsentMessages; unsentMessages = null
                    for (var i = 0; i < um.length; i++)
                        sendMessage(um[i])
                }
                if (isWritable) page.find(".prog-screenshot.button").removeClass("template").click( screenshot )
            }
            if (message.screenshot && isWritable && (!message.autoscreenshot || !haveScreenshot)) {
                haveScreenshot = true
                apiPut( {user:username, folder:folder, program:program}, { screenshot: message.screenshot }, function(){} )
            }
            if (message.error) {
                // Only Chrome (Aug. 2012) gives line numbers in error messages!
                var syntaxpattern = /(SyntaxError[^\d]*)([\d]*)/
                var findsyntax = message.error.match(syntaxpattern)
                if (findsyntax === null && parseVersionHeader(null).lang == 'javascript') {
                	var u = message.error.split('\n')
                	var m = u[0].match(/:(\d*):\d*:.*:(.*)/)
                	if (m !== null) {
	                	message.error = 'Error in line '+(m[1]-5)+':'+m[2]
	                	message.traceback = u[1]+'\n'+u[2]
                	}                    
                }
                if ($dialog) $dialog.dialog("close")
                $dialog = $("#program-error-dialog").clone().removeClass("template")
                $dialog.find(".error-details").text(message.error)
                $dialog.find(".error-traceback").text(message.traceback)
                $dialog.dialog({ width: "600px", autoOpen: true })
            }
        }
    }
    pages.share = function(route) {
        var username = route.user, folder = route.folder, program = route.program
        var isWritable = route.user === loginStatus.username

        var page = $(".sharePage.template").clone().removeClass("template")
        page.find("a.username").prop("href", unroute(route, {page:"user"}))
        page.find(".username").text(username)
        page.find(".foldername").text(folder)
        page.find(".programname").text(program) // + ", IDE jQuery ver. " + jQuery.fn.jquery) // To show IDE jQuery version number at top of IDE during share.
        page.find(".prog-edit.button").prop("href", unroute(route, {page:"edit"}))
        if (isWritable) page.find(".prog-edit.button").text('Edit this program')
        else page.find(".prog-edit.button").text('View this program')
        var base_link = window.location.protocol + "//" + window.location.host + window.location.pathname
        var folder_link = base_link + unroute(route, {page:"folder"})
        var run_link = base_link + unroute(route, {page:"run"})
        page.find(".run-link").prop("href", run_link).text(run_link)
        page.find(".folder-link").prop("href", folder_link).text(folder_link)
        pageBody.html(page)

        apiGet( route, function (progData) {
            var header = parseVersionHeader(progData.source)

            // TODO: Load compiler in iframe (like run page)
            if (!header.ok)
                page.find(".embedWarning").text("This program cannot be embedded because its version declaration is unknown.")
            else {
                if (header.unpackaged) 
                    page.find(".embedWarning").text("Embedding programs with development versions of GlowScript is not recommended.  They will likely be broken by further changes, and the packages used for embedding may not match the packages used to run in an development version.")
                var compiler_url
                if (header.lang == 'vpython') {
                	compiler_url = "../package/RScompiler." + header.version + ".min.js"
                } else compiler_url = "../package/compiler." + header.version + ".min.js"
                window.glowscript_compile = undefined
                $.ajax({
                    url: compiler_url,
                    dataType: "script",
                    cache: true,
                    crossDomain: true  // use script tag rather than xhr
                }).fail(function (xhr, err, exc) {
                    (xhr);
                    alert(err + " getting " + xhr.url + ": " + exc)
                }).done(function () {
                    if (!window.glowscript_compile) {
                        alert("Failed to load compiler from package: " + compiler_url)
                        return
                    }
	                
                    // Look for mention of MathJax in program; don't import it if it's not used
                    var mathjax = ''
                    if (header.source.indexOf('MathJax') >= 0)
                    	mathjax = '<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-MML-AM_CHTML"></script>\n'

					var embedScript = window.glowscript_compile(header.source,
                    		{lang: header.lang, version: header.version.substr(0,3), run: false})
                    var divid = "glowscript"
                    var remove = header.version==='0.3' ? '' : '.removeAttr("id")'
                    var main
                    var v = Number(header.version.substr(0,3))
                    if (v >= 2.9) main = '__main__()' // Starting August 2019, no longer using Streamine
                    else if (v == 2.8) main = 'main(function(err) {;})' // Starting June 2019, using up-to-date Streamline file
                    else if (v >= 2.0) main = 'main(__func)' // Starting Dec. 2015, using Streamline files from Salvatore di Dio
                    else main = 'main()'
                    embedScript = ";(function() {" + embedScript + '\n;$(function(){ window.__context = { glowscript_container: $("#' + divid + '")'+remove+' }; '+main+' })})()'

                    embedScript = embedScript.replace("</", "<\\/") // escape anything that could be a close script tag... hopefully this sequence only occurs in strings!
                    var verdir = "bef1.1"
                    if (v == 1.1) verdir = "1.1"
                    else if (v >= 2.2) verdir = "2.1"
                    else verdir = header.version.substr(0,3)
                    var runner = ''
                    var exporturl = "https://www."+website+"/"
                    if (v >= 2.5 && v < 3.0) exporturl = "https://s3.amazonaws.com/glowscript/"
                    // Note: some already exported 3.0 programs contain references to s3.amazonaws.com
                    if (header.lang == 'vpython') 
                    	runner = '<script type="text/javascript" src="'+exporturl+'package/RSrun.' + header.version + '.min.js"></script>\n'
                    var embedHTML = (
                        '<div id="' + divid + '" class="glowscript">\n' + 
                        '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n' +
                        '<link type="text/css" href="'+exporturl+'css/redmond/' + verdir + '/jquery-ui.custom.css" rel="stylesheet" />\n' +
                        '<link type="text/css" href="'+exporturl+'css/ide.css" rel="stylesheet" />\n' + 
                        mathjax +
                        '<script type="text/javascript" src="'+exporturl+'lib/jquery/' + verdir + '/jquery.min.js"></script>\n' +
                        '<script type="text/javascript" src="'+exporturl+'lib/jquery/' + verdir + '/jquery-ui.custom.min.js"></script>\n' +
                        '<script type="text/javascript" src="'+exporturl+'package/glow.' + header.version + '.min.js"></script>\n' +
                        runner +
                        '<script type="text/javascript"><!--//--><![CDATA[//><!--\n\n// START JAVASCRIPT\n' +
                        embedScript + '\n// END JAVASCRIPT\n' +
                        '\n//--><!]]></script>' +
                        '\n</div>');
                    page.find(".embedSource").text( embedHTML )
                })
            }
        })

        var frameSrc = run_link
        var frameHTML = '<iframe style="border-style:none; border:0; width:650px; height:500px; margin:0; padding:0;" frameborder=0 src="' + frameSrc + '"></iframe>'
        page.find(".frameSource").text( frameHTML );
    }
    pages.downloadProgram = function(route) { // Currently the only program option is download (download a program to user computer)
        apiDownload( {user:route.user, folder:route.folder, program: route.program, option:'downloadProgram'}, function(ret) {
    		window.location = apiURL(route) // this sends the file to the user's download folder
        	navigate(unroute(route, {page:"edit"})) // return to (stay on) edit page
    	})
    }
    pages.edit = function(route) {
        var username = route.user, folder = route.folder, program = route.program // string variables
        
        var isWritable = route.user === loginStatus.username
        if (disable_writes) isWritable = false

        var page = $(".editPage.template").clone().removeClass("template")
        page.find("a.username").prop("href", unroute({page:"user", user:username}))
        page.find(".username").text(username)
        //page.find(".foldername").text(folder) // not displayed; not referenced in index.html
        page.find(".programname").text(program) // + ", IDE jQuery ver. " + jQuery.fn.jquery) // To show IDE jQuery version number at top of IDE during edit.
        var run_link = unroute({page:"run", user:username, folder:folder, program:program})
        page.find(".prog-run.button").prop("href", run_link).prop("title", "Press Ctrl-1 to run\nPress Ctrl-2 to run in another window")
        page.find(".prog-share.button").prop("href", unroute({page:"share", user:username, folder:folder, program:program}))
        page.find(".prog-download.button").prop("href", unroute({page:"downloadProgram", user:username, folder:folder, program:program}))
        if (!isWritable) page.find(".readonly").removeClass("template")

        pageBody.html(page)

        // I decided to process shortcuts myself instead of relying on ACE, because 
        // ACE might not always have focus
        $(document).keydown( shortcutKey )
        onNavigate.on( function(cb) { $(document).off("keydown", shortcutKey); cb() } )
        function shortcutKey(ev) {
            // Ctrl-1: Run
            // I (David Scherer) haven't figured out how to change or disable keyboard shortcuts in ACE, 
            // so Ctrl-R is not available - I used Ctrl-1 (like Ctrl-!)
            if (ev.ctrlKey && ev.keyCode == "1".charCodeAt(0)) {
                ev.preventDefault()
                navigate(run_link)
            }
            if (ev.ctrlKey && ev.keyCode == "2".charCodeAt(0)) {
                ev.preventDefault()
                // If I don't pass anything for features, I get a new tab instead
                var features = "titlebar=yes,location=yes,resizable=yes,scrollbars=yes,status=yes,toolbar=yes"
                window.open("/#/", "GlowScriptRun", features)
                window.open(run_link, "GlowScriptRun", features)
            }
        }

        apiGet( {user:username, folder:folder, program:program}, function (progData) {
        	page.find(".prog-datetime").text(date_to_string(progData.datetime))
        	// program is the name of the file; progData.source is the program source in that file
        	var lang = parseVersionHeader(progData.source).lang
            if (!(lang == 'javascript' || lang == 'vpython')) lang = 'javascript'
            
            if (navigator.userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)) {
	        	var editor = GSedit
	            window.editor = editor
	            editor.init(page.find(".program-editor"), progData.source, !isWritable)
	            if (isWritable) {
	                var save = saver( {user:username, folder:folder, program:program},
	                    function () { return editor.getValue() },
	                    function (status) { page.find(".program-status").text(" ("+status+")") }
	                )
	                // Save immediately when navigating away from this page
	                onNavigate.on(function (cb) { save(0, cb) })
	                editor.change = function () {
	                    save(1000)  // Save after 1 second of not typing
	                }
	            }            	
            } else {
	            var editor = ace.edit(page.find(".program-editor").get(0));
	            window.editor = editor
	            customACEMode(lang, progData.source)
	            var mode = ace_require("ace/mode/visualjs").Mode
		        editor.getSession().setMode(new mode())
	            editor.setTheme({ cssClass: "ace-custom" })
	            editor.getSession().setValue(progData.source)
                editor.setReadOnly( !isWritable )
	            editor.selection.moveCursorDown() // position cursor at start of line 2, below GlowScript header
                editor.focus()
	            if (isWritable) {
	                var save = saver( {user:username, folder:folder, program:program},
		                function () { return editor.getSession().getValue() },
	                    function (status) { page.find(".program-status").text(" ("+status+")") }
	                )
	                // Save immediately when navigating away from this page
	                onNavigate.on(function (cb) { save(0, cb) })
	                editor.getSession().on('change', function () {
	                    save(1000)  // Save after 1 second of not typing
	                })
	            }
            }
            
        })
    }
    
    // NOTE: We use the "ace_require" function found in ace.js

    /*********** Customization of the ACE editor *************/
    // See https://github.com/ajaxorg/ace/wiki/Creating-or-Extending-an-Edit-Mode
    // mode-javascript.js is loaded by ide/index.html.
    // These modules in turn load worker-javascript.js in lib/ace.
    // See lib/ace/FileSource.txt for where to find updated ACE files, and how they
    // were modified in minor ways for GlowScript use.
    var customACEMode = function(lang, source) { // lang is "javascript" or some fragment
        
        var lib = "identifier.builtin"
        var attr = "attribute.builtin"
        var libraryWords = {
            pos: attr, axis: attr, up: attr, /*color: attr, */ x: attr, y: attr, z: attr, size: attr,
            visible: attr, forward: attr, length: attr, width: attr, radius: attr,
            wait: "keyword.wait"
        }

        // Adding "var" and "function" to libraryWords for JavaScript should be unnecessary,
        // but without them they aren't colorized red as they were in earlier ACE:
        if (lang == 'javascript') {
            libraryWords.var = "keyword"
            libraryWords.function = "keyword"
        }
        
        var globals = []
        if (window.GlowscriptLibraryNames)
            for (var i=0; i<window.GlowscriptLibraryNames.length; i++) {
                var id = window.GlowscriptLibraryNames[i]
                if (libraryWords[id] === undefined)
                    libraryWords[id] = lib
            }
        for(var id in libraryWords) { // e.g. {sphere : identifier.builtin}
            if (!libraryWords[id]) delete libraryWords[id];
            if (libraryWords[id] == lib) globals.push(id)
        }
        
        // The "//" at the end of lintPrefix comments out the line "GlowScript X.Y", hence ignored by the worker looking at JavaScript syntax
        var lintPrefix = "/*jslint asi:true, undef:true*/ /*global wait " + globals.join(" ") + "*/\n//"

        define('ace/mode/visualjs_highlight_rules', function (ace_require, exports, module) {
            var oop = ace_require("ace/lib/oop")
            var Rules
            if (lang == 'vpython') Rules = ace_require("ace/mode/python_highlight_rules").PythonHighlightRules
            else Rules = ace_require("ace/mode/javascript_highlight_rules").JavaScriptHighlightRules

            var VisualHighlightRules = function () {
                this.$rules = (new Rules()).getRules()
                if (lang == 'vpython') this.$rules.start = [{ regex: /GlowScript\s+[\d\.]*[dev]*\s+[A-Za-z]*/, token: "keyword.version_header" } ].concat(this.$rules.start)
                else this.$rules.start = [{ regex: /GlowScript\s+[\d\.]*[dev]*/, token: "keyword.version_header" } ].concat(this.$rules.start)
                for(var id in libraryWords) {
                    this.$rules.start = [{ regex: id, token: libraryWords[id] } ].concat(this.$rules.start)
                }
            }
            oop.inherits(VisualHighlightRules, Rules)
            exports.VisualHighlightRules = VisualHighlightRules
        })
        
        
        //------------------------------------------------------------------------------------------------------
        define('ace/mode/visualjs', function (ace_require, exports, module) {
            var oop = ace_require("ace/lib/oop")
            if (lang == 'vpython') var BaseMode = ace_require("ace/mode/python").Mode
            else var BaseMode = ace_require("ace/mode/javascript").Mode
            var Tokenizer = ace_require("ace/tokenizer").Tokenizer
            var VisualHighlightRules = ace_require("ace/mode/visualjs_highlight_rules").VisualHighlightRules
            var WorkerClient = ace_require("ace/worker/worker_client").WorkerClient // *****************************************************

            var Mode = function () {
                BaseMode.call(this)
                this.$tokenizer = new Tokenizer((new VisualHighlightRules()).getRules());
            }
            oop.inherits(Mode, BaseMode); // nead a semicolon here due to following left parens
            
            // There was formerly "worker" machinery here which showed a warning icon at the left of an line with an error, but
            //     (1) This tends to confuse students.
            //     (2) GlowScript catches lots of errors already with respect to parens, brackets, braces, and quotes.
            //     (3) Highlighting is handled separately, so is not affected by eliminating workers.
            //     (4) Caused some awkwardness in changing the language on the first line.
            //     (5) And the killer issue: workers chew up LOTS of CPU time for little gain.
            
            exports.Mode = Mode
        })
    }

    function iframefix() {
        // When a mouse operation is started outside an iframe, cover all iframes on the page so
        // that mousemove events don't get eaten by them.  Supposedly jquery UI 1.9 will have this
        // feature, so maybe this can be removed in the future.

        $(document).mousedown(function(ev) {
            $("iframe").not(".iframefix").not(".template iframe").each( function() {
                ("iframefix", this, this.offsetWidth, this.offsetHeight, this.width)
                $('<div class="iframefix" style="background: #fff;"></div>')
                    .css({
                        width: this.offsetWidth+"px", 
                        height: this.offsetHeight+"px",
                        position: "absolute",
                        opacity: "0.001",
                        zIndex: 1000 })
                    .css($(this).offset())
                    .appendTo("body")
            })
        })
        $(document).mouseup(function(ev) {
            $(".iframefix").remove()
        })
    }
    iframefix()

    window.onhashchange()
})