$(function () {
    "use strict";
    
    var worker
    var sourceLines

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
        var rest = source.substr( header.length+1 )
        var ret = {
            version: null,
            lang: '', // 'vpython' (default) or 'rapydscript' or 'javascript' or a string that is neither (e.g. when editing header)
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
            if (!(ret.lang == 'javascript' || ret.lang == 'coffeescript' || ret.lang == 'rapydscript' || ret.lang == 'vpython')) return ret
        }
        var ver = elements[1]
        var okv = parseVersionHeader.okVersions[ver]
        if (okv === undefined) okv = false
        var unpackaged = (okv === "unpackaged")
        return {
            version: ver,
            lang: ret.lang,
            source: rest, 
            ok: okv, 
            unpackaged:unpackaged, 
            isCurrent: okv && (unpackaged || ver==parseVersionHeader.defaultVersion) 
        }
    }
    
    parseVersionHeader.defaultVersion = "2.6"
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
        "2.6dev" : "unpackaged",
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
                }
            }
            return u;
        } else {
            (route)
            throw Error("Unknown API route");
        }
    }
    function apiGet(route, callback) {
        var url = apiURL(route)
    	//console.log(url, route)
        $.ajax({
            type: 'GET',
            url: url,
            dataType: 'json',
            success: callback,
            error: function (xhr, message, exc) {
                apiError("API " + message + " getting " + url + ": " + exc)
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
            //contentType: 'application/json',
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
    function apiRename(route, callback) {
    	console.log('apiRename', route)
        var url = apiURL(route)
        $.ajax({
            type: 'RENAME',
            url: url,
            headers: { 'X-CSRF-Token': loginStatus.secret },
            dataType: 'text',
            success: callback,
            error: function (xhr, message, exc) {
                apiError("API " + message + " renaming " + url + ": " + exc)
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
                    callback(false);
                else
                    apiError("API " + message + " getting " + url + ": " + exc)
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
            if (saving) return;
            saving = true;
            savingSource = getProgramSource()
            var save = { 
                source: savingSource,
                //description: ""  // Or comment this out to allow a program to retain a description removed from the source?
            }

            var descriptionCommentMatch = savingSource.match(/^(?:GlowScript.*\r?\n|#.*\r?\n|\r?\n)*\/\*([^\x00]*?)\*\//)
            if (descriptionCommentMatch) save.description = descriptionCommentMatch[1]

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
                            if (val != $name.val()) return;
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
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)");
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            });
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
    pages.folder = function (route) {
        var username = route.user, folder = route.folder
        var isWritable = route.user === loginStatus.username

        var page = $(".folderPage.template").clone().removeClass("template")
        var programTemplate = page.find(".program.template")
        var folderTemplate = page.find(".folderListItem.template")

        if (!isWritable) {
            page.find(".program-new.button").addClass("template")
            page.find(".folder-new-tab").addClass("template")
        }

        page.find(".username").text(username) // + ", IDE jQuery ver. " + jQuery.fn.jquery) // To show IDE jQuery version number at top of IDE during run.
        page.find(".foldername").text(folder)
        pageBody.html(page)

        function createDialog( templ, doCreate ) {
            var $dialog = $(templ).clone().removeClass("template")
            $dialog.dialog({
                width: 300,
                resizable: false,
                modal: true,
                autoOpen: true,
                buttons: {
                    "Create": function () {
                        doCreate($(this));
                        $(this).dialog("close");
                    },
                    "Cancel": function () { $(this).dialog("close"); }
                },
                close: function () {  }
            }).submit(function(ev){
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)");
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            });
        }

        function renameDialog( templ, oldname, doRename ) {
        	console.log('renameDialog')
            var $dialog = $(templ).clone().removeClass("template")
            $dialog.find(".name").text(oldname)
            $dialog.find(".rename-default").val(oldname)
            $dialog.dialog({
                width: 300,
                resizable: false,
                modal: true,
                autoOpen: true,
                buttons: {
                    "Rename": function () {
                        doRename($(this));
                        $(this).dialog("close");
                    },
                    "Cancel": function () { $(this).dialog("close"); }
                },
                close: function () {  }
            }).submit(function(ev){
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)");
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            });
        }

        function delProgramOrFolder(templ, name, action) {
            var $dialog = $(templ).clone().removeClass("template")
            if (!name) return;
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
                var $button = $dialog.siblings('.ui-dialog-buttonpane').find("button:eq(0)");
                if (!$button.prop("disabled")) $button.click()
                ev.preventDefault()
                return false
            });
            return false;
        }

        page.find(".folder-new").click(function (ev) {
            ev.preventDefault()
            createDialog("#folder-new-dialog", function($dlg) {
                var name = $dlg.find('input[name="name"]').val()
                if (name == 'Add Folder') return false;
                name = name.replace(/ /g,'') // There are problems with spaces or underscores in names
                name = name.replace(/_/g,'')
                var p = $dlg.find('input[name="isPublic"]').is(":checked") // true is checked, which means public
                apiPut({user:username, folder:name}, {public:p}, function () {
                    navigate( {page:"folder", user:username, folder:name} )
                })
            })
            return false;
        })

        page.find(".folder-delete").click(function (ev) {
            ev.preventDefault();
            return delProgramOrFolder("#folder-delete-dialog", folder, function() {
                apiDelete( {user:username, folder:folder}, function () {
                    navigate( {page:"user", user:username} )                
                })                
            })
        })

        page.find(".program-new").click(function (ev) {
            ev.preventDefault()
            createDialog("#prog-new-dialog", function($dlg) {
                var name = $dlg.find('input[name="name"]').val()
                name = name.replace(/ /g,'') // There are problems with spaces or underscores in names
                name = name.replace(/_/g,'')
                apiPut({user:username, folder:folder, program:name}, { source: parseVersionHeader.defaultHeader+"\n" }, function () {
                    navigate({page:"edit", user:username, folder:folder, program:name})
                })
            })
            return false;
        })

        // Get a list of folders.  May return multiple times if list is updated
        getFolderList(username, function (data) {
            page.find(".folderList > .templated").remove()
            var before = folderTemplate.next()
            var folders = data.folders
            for (var i = 0; i < folders.length; i++) {
                var h = folderTemplate.clone().removeClass("template").addClass("templated")
                var name = decode(folders[i])
                if (name == folder) h.addClass("ui-tabs-active").addClass("ui-state-active")
                h.find(".folder-name").text(name).prop("href", unroute({page:"folder", user:username, folder:name}))
                h.insertBefore(before)
            }
        })

        // Get a list of programs from the server
        apiGet( {user:username, folder:folder, program:LIST}, function (data) {
            var progList = page.find(".programs")
            var programs = data.programs
            for (var i = 0; i < programs.length; i++) {
	                (function (prog) {
	                var p = programTemplate.clone().removeClass("template")
	                var name = decode(prog.name)
	                var proute = { user:username, folder:folder, program:name }
	                p.find(".prog-run.button").prop("href", unroute(proute, {page:"run"}))
	                p.find(".prog-edit.button").prop("href", unroute(proute, {page:"edit"}))
	                p.find(".prog-name").text(name)
	
	                // TODO: Apply a sanitizer + markdown?
	                /* Description not really useful any more
	                var $desc = p.find(".prog-description")
	                $desc.text(prog.description)
	                $desc.html( $desc.html().replace(/\n\n/g,"<br/>") )
	                */
	
	                if (!isWritable) {
	                    p.find(".prog-rename.button").addClass("template")
	                    p.find(".prog-delete.button").addClass("template")
	                    p.find(".prog-edit.button").text("View")
	                }
	            	
	                p.find(".prog-rename.button").click(function (ev) { 
	                	ev.preventDefault()
	                    renameDialog("#prog-rename-dialog", name, function($dlg) {
	                        var newname = $dlg.find('input[name="name"]').val()
	                        newname = newname.replace(/ /g,'') // There are problems with spaces or underscores in names
	                        newname = newname.replace(/_/g,'')
	                        apiRename({user:username, folder:folder, program:name}, function () {
	                            navigate({page:"folder", user:username, folder:folder, oldname:name, newname:newname})
	                        })
	                    })
	                    return false;
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
	            })(programs[i])
            }
            if (isWritable && programs.length==0) page.find(".folder-delete").removeClass("template")
            else page.find(".folder-delete").addClass("template")
        })
    }
    pages.run = function(route) {
        try {
            var username = route.user, folder = route.folder, program = route.program // folder and program may contain spaces
            var isWritable = route.user === loginStatus.username

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

            var untrusted_src = "http://sandbox.glowscript.org/untrusted/run.html"
            var untrusted_origin = "http://sandbox.glowscript.org"
            var ready = false
            
            try {
                if (localStorage.dev) {
                    untrusted_origin = "http://" + localStorage.dev
                    untrusted_src = untrusted_origin + "/untrusted/run.html"
            
                    var NotRunningTheDevServerTimeout = setTimeout( function() {
                        if (!ready)
                            alert("You have configured glowscript.org to load files from '" + untrusted_origin + "', but that server is apparently not responding.  Try setting localStorage.dev='' in the console.")
                    }, 5000)
                    onNavigate.on(function(cb) { clearTimeout(NotRunningTheDevServerTimeout); cb() })
                } else if (document.domain == "localhost") {
                    untrusted_src = "/untrusted/run.html";
                    untrusted_origin = "http://" + window.location.host;
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
            })
        } catch (err) {
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
            event = event.originalEvent
            if (event.origin !== untrusted_origin) return;
            // CAREFUL: We can't trust this data - it could be malicious!  Incautiously splicing it into HTML could be deadly.
            var message = JSON.parse(event.data)
            if (message.ready) {
                ready = true;
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
                if (header.lang == 'vpython' || header.lang == 'rapydscript') {
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
                    	mathjax = '<script type="text/javascript" src="http://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-MML-AM_CHTML"></script>\n'

					var embedScript = window.glowscript_compile(header.source,
                    		{lang: header.lang, version: header.version.substr(0,3), run: false})
                    var divid = "glowscript"
                    var remove = header.version==='0.3' ? '' : '.removeAttr("id")'
                    var main
                    if (header.lang == 'coffeescript') {
                        // The CoffeeScript -> JavaScript converter wraps the code in an extra protective layer, in addition
                        // to the wrapper imposed by GlowScript. The following code effectively unwraps the extra layer.
                        // There's probably a far more elegant way to deal with this....
                        var fname = '__RUN_GLOWSCRIPT'
                        main = fname+'()()'
                        embedScript = embedScript.slice(0,where+1) + fname + ' = ' + embedScript.slice(where+2,embedScript.length)
                        where = embedScript.indexOf('}).call(this)')
                        embedScript = embedScript.slice(0,where+1) + embedScript.slice(where+13,embedScript.length)
                    }
                    var v = Number(header.version.substr(0,3))
                    if (v >= 2.0) main = 'main(__func)' // Starting Dec. 2015, using Streamline files from Salvatore di Dio
                    else main = 'main()'
                    embedScript = ";(function() {" + embedScript + '\n;$(function(){ window.__context = { glowscript_container: $("#' + divid + '")'+remove+' }; '+main+' })})()'

                    embedScript = embedScript.replace("</", "<\\/") // escape anything that could be a close script tag... hopefully this sequence only occurs in strings!
                    var verdir = "bef1.1"
                    if (v == 1.1) verdir = "1.1"
                    else if (v >= 2.2) verdir = "2.1"
                    else verdir = header.version.substr(0,3)
                    var runner = ''
                    var exporturl = "http://www.glowscript.org/"
                    if (v >= 2.5) exporturl = "https://s3.amazonaws.com/glowscript/"
                    if (header.lang == 'vpython' || header.lang == 'rapydscript') 
                    	runner = '<script type="text/javascript" src="'+exporturl+'package/RSrun.' + header.version + '.min.js"></script>\n'
                    var embedHTML = (
                        '<div id="' + divid + '" class="glowscript">\n' + 
                        '<link type="text/css" href="'+exporturl+'css/redmond/' + verdir + '/jquery-ui.custom.css" rel="stylesheet" />\n' + 
                        '<link href="https://fonts.googleapis.com/css?family=Inconsolata" rel="stylesheet" type="text/css" />\n' + 
                        '<link type="text/css" href="'+exporturl+'css/ide.css" rel="stylesheet" />\n' + 
                        mathjax +
                        '<script type="text/javascript" src="'+exporturl+'lib/jquery/' + verdir + '/jquery.min.js"></script>\n' +
                        '<script type="text/javascript" src="'+exporturl+'lib/jquery/' + verdir + '/jquery-ui.custom.min.js"></script>\n' +
                        '<script type="text/javascript" src="'+exporturl+'package/glow.' + header.version + '.min.js"></script>\n' +
                        runner +
                        '<script type="text/javascript"><!--//--><![CDATA[//><!--\n' +
                        embedScript +
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
    pages.edit = function(route) {
        var username = route.user, folder = route.folder, program = route.program
        
        var isWritable = route.user === loginStatus.username

        var page = $(".editPage.template").clone().removeClass("template")
        page.find("a.username").prop("href", unroute({page:"user", user:username}))
        page.find(".username").text(username)
        page.find(".foldername").text(folder)
        page.find(".programname").text(program) // + ", IDE jQuery ver. " + jQuery.fn.jquery) // To show IDE jQuery version number at top of IDE during edit.
        var run_link = unroute({page:"run", user:username, folder:folder, program:program})
        page.find(".prog-run.button").prop("href", run_link).prop("title", "Press Ctrl-1 to run\nPress Ctrl-2 to run in another window")
        page.find(".prog-share.button").prop("href", unroute({page:"share", user:username, folder:folder, program:program}))
        if (!isWritable) page.find(".readonly").removeClass("template")

        // TODO: "Copy this program" link when not writable

        pageBody.html(page)

        // I decided to process shortcuts myself instead of relying on ACE, because 
        // ACE might not always have focus
        $(document).keydown( shortcutKey )
        onNavigate.on( function(cb) { $(document).off("keydown", shortcutKey); cb() } )
        function shortcutKey(ev) {
            // Ctrl-1: Run
            // I haven't figured out how to change or disable keyboard shortcuts in ACE, 
            // so Ctrl-R is not available - I used Ctrl-1 (like Ctrl-!)
            if (ev.ctrlKey && ev.keyCode == "1".charCodeAt(0)) {
                ev.preventDefault()
                navigate(run_link)
            }
            if (ev.ctrlKey && ev.keyCode == "2".charCodeAt(0)) {
                ev.preventDefault()
                // If I don't pass anything for features, I get a new tab instead
                var features = "titlebar=yes,location=yes,resizable=yes,scrollbars=yes,status=yes,toolbar=yes"
                //window.open("/#/", "GlowScriptRun", features, true)
                //window.open(run_link, "GlowScriptRun", features, true)
                window.open("/#/", "GlowScriptRun", features, true)
                window.open(run_link, "GlowScriptRun", features, true)
            }
        }

        apiGet( {user:username, folder:folder, program:program}, function (progData) { 
        	var lang = parseVersionHeader(progData.source).lang
            if (!(lang == 'javascript' || lang == 'coffeescript' || lang == 'rapydscript' || lang == 'vpython')) lang = 'javascript'
            
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
    // mode-javascript.js and mode-coffee.js are loaded by ide/index.html.
    // These modules in turn load worker-javascript.js and worker-coffee.js in lib/ace.
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
            if (lang == 'coffeescript' || lang == 'rapydscript' || lang == 'vpython') var Rules = ace_require("ace/mode/coffee_highlight_rules").CoffeeHighlightRules
            else var Rules = ace_require("ace/mode/javascript_highlight_rules").JavaScriptHighlightRules

            var VisualHighlightRules = function () {
                this.$rules = (new Rules()).getRules()
                if (lang == 'rapydscript' || lang == 'vpython') this.$rules.start = [{ regex: /GlowScript\s+[\d\.]*[dev]*\s+[A-Za-z]*/, token: "keyword.version_header" } ].concat(this.$rules.start)
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
            if (lang == 'rapydscript' || lang == 'vpython') var BaseMode = ace_require("ace/mode/python").Mode
            else var BaseMode = ace_require("ace/mode/javascript").Mode
            var Tokenizer = ace_require("ace/tokenizer").Tokenizer
            var VisualHighlightRules = ace_require("ace/mode/visualjs_highlight_rules").VisualHighlightRules
            var WorkerClient = ace_require("ace/worker/worker_client").WorkerClient // *****************************************************

            var Mode = function () {
                BaseMode.call(this)
                this.$tokenizer = new Tokenizer((new VisualHighlightRules()).getRules());
            }
            oop.inherits(Mode, BaseMode); // nead a semicolon here due to following left parens
            
            
            (function () {
                this.createWorker = function (session) { // *****************************************************
                    
                    if (worker !== undefined && worker !== null) worker.terminate() // stop a previous worker
                    
                    //if (lang == 'javascript') worker = new WorkerClient(["ace"], "ace/mode/javascript_worker", "JavaScriptWorker")
                    worker = new WorkerClient(["ace"], "ace/mode/javascript_worker", "JavaScriptWorker")
                    
                    var doc = session.getDocument()
                    if (worker !== undefined && worker !== null) worker.$doc = doc // must set this in order to be able to execute worker.terminate()
                    
                    //if (lang == 'rapydscript' || lang == 'vpython') worker.call("setValue", [''])
                    //else worker.call("setValue", [lintPrefix])
                    worker.call("setValue", [lintPrefix])

                    var header = null
                    var headerError = null

                    doc.on("change", function (e) {
                        // Check the header declaration and adjust for the lintPrefix comment /* */ inserted before JavaScript source
                        var ee = JSON.parse(JSON.stringify(e)) // We don't want to modify our parameter, so clone it
                        
                        if (e.data.range.start.row === 0) {
                            // Could note that language has changed, suggest reloading the page
                            header = parseVersionHeader(doc.getValue())
                            if ((header.lang == 'javascript' || header.lang == 'coffeescript' || header.lang == 'rapydscript' || header.lang == 'vpython') && header.lang != lang) 
                                alert("Reload the page to switch to editing " + header.lang)
                            else if (header.isCurrent)
                                headerError = null
                            else if (header.ok)
                                headerError = { row: 0, column: 0, text: "Not the current version.  Expected: " + parseVersionHeader.errorMessage, type: "warning" }
                            else
                                headerError = { row: 0, column: 0, text: "Missing required version declaration.  Expected: " + parseVersionHeader.errorMessage, type: "error" }

                            ee.data.range.start.column += 2
                        }
                        if (e.data.range.end.row === 0) 
                            ee.data.range.end.column += 2
                        
                        if (lang == 'javascript') {
                            // Adjust for the fact that we inserted a row into JavaScript documents sent to the worker.
                            ee.data.range.start.row += 1
                            ee.data.range.end.row += 1
                            ee.range = { start: ee.data.range.start, end: ee.data.range.end }
                        }

                        worker.emit("change", ee)
                    })
                    
                    // CoffeeScript (no conflict with worker.on options for JavaScript):
                    worker.on("error", function(e) {
                        var errors = [e.data]
                        errors[0].row += 1
                        if (headerError) errors.push(headerError)
                        session.setAnnotations(errors)
                    })
                    
                    worker.on("ok", function(e) {
                        session.clearAnnotations()
                    })

                    // JavaScript (no conflict with worker.on options for CoffeeScript):
                    worker.on("jslint", function (results) {
                        var errors = [];
                        if (headerError) errors.push(headerError)
                        for (var i = 0; i < results.data.length; i++) {
                            var error = results.data[i];
                            if (error) {
                                errors.push({
                                    row: error.line - 2,
                                    column: error.character - 1,
                                    text: error.reason,
                                    type: "warning",
                                    lint: error
                                })
                            }
                        }
                        session.setAnnotations(errors)
                    })

                    worker.on("narcissus", function (e) {
                        var errors = [e.data]
                        errors[0].row -= 1
                        if (headerError) errors.push(headerError)
                        session.setAnnotations(errors)
                    })

                    return worker
                }
                
            }).call(Mode.prototype)
            
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