### OBTAINING THE LATEST VERSION OF GLOWSCRIPT OFFLINE
Based on the work of [Vesa Lappalainen](https://github.com/vesal) of Finland, this package makes it possible to write and run
GlowScript programs even when disconnected from the internet.  

To obtain the latest version of this package, go to the following location:
* https://github.com/vpython/glowscript/blob/master/
Click the latest version of GlowScriptOfflineX.Y.zip and click the download icon.

### CHOICE OF BROWSER
It is recommended to use the Chrome browser, as it is the only browser that provides detailed information on run-time errors and also makes it possible to use textures and JavaScript libraries. You can use a different browser if these issues are not important to you.

### RUNNING PROGRAMS
Inside this folder, double click `GlowScript.html`. This will start up your preferred browser.

As a test, enter `box()` into the left (edit) pane.

Click `Run` to run the program. To rotate, zoom, or pan the scene:
* Right-button drag or `Ctrl`-drag to rotate the "camera" to view scene
* To zoom, drag with middle button or `Alt`/`Option` depressed, or use scroll wheel
  * On a two-button mouse, middle is left + right
* `Shift`-drag to pan left/right and up/down
* Touch screen: pinch/extend to zoom, swipe or two-finger rotate.

You can drag the vertical gray bar (and/or make the window wider or narrower) to arrange the edit and execution regions the way you want them. Make changes to the program and click `Run` again. If you add a print statement a print area will appear at the right.

You can run or restart your program by pressing `Ctrl-1` or `Ctrl-2`, just as you can at glowscript.org.

### SAVING YOUR CHANGES
Click Save to save your program. It will be written to your `Download` folder (browser security rules forbid writing it anywhere else). You will be asked for a name. Suppose you specify `test`. If your program is VPython, the `Download` folder will have a file named `test.py`, otherwise it will be `test.js` (JavaScript). If in one session you do multiple saves, your `Download` folder will have multiple copies: `test.py`, `test(1).py`, etc.

If you create or modify a program without saving it and click `Choose File` (`Browse`... on Firefox or Edge), you'll see a warning that you might wish to save your work. Similarly, when you attempt to close the browser or the browser tab, if you have modified the current program you'll be warned about saving the file.

### DEMO PROGRAMS INCLUDED
Click `Choose File` and navigate to the `GlowScriptOffline` folder to choose from programs in the `Demos` folder. Those demo programs that use textures will not display correctly when offline unless you start the package in a special way [described below](#using-textures-or-javascript-libraries) in the section "Using Textures or JavaScript Libraries."

### DOCUMENTATION INCLUDED
The Web VPython documentation is included in the package and is accessible by clicking `Help`.

### USING THE TEXT EDITOR
In the text editor, as in the editor at glowscript.org, select one or more lines and press `TAB` to indent or `Shift-TAB` to unindent; press `Ctrl-/` to toggle commenting of the lines. Pressing `TAB` with the cursor at the end of the line adds spaces to the end of that line. At the moment, find and replace options are not yet available; you can of course copy the program to a local text editor to use find and replace, then copy it back.

### USING PROGRAMS FROM glowscript.org OR FROM VPYTHON 7
When you download programs from [glowscript.org](http://www.glowscript.org), they are in the form of `.py` files whose first line is a statement about importing Vpython, like programs created with VPython 7. This first line is understood by the offline package, as is `Web VPython X.Y` or `JavaScript X.Y` or `GlowScript X.Y VPython` or `GlowScript X.Y JavaScript`.

### EXPORTING A PROGRAM
When you click `Export`, your program is processed to create code that can be embedded in your own web site, just like using the option `Share or export this program` at glowscript.org. This processed code temporarily replaces your own program code. If you click `Save` and give the name "test", a file named `test.html` will be written to your `Download` folder. Alternatively, press `Ctrl-C` to copy the code (all of which is preselected for you), then use a text editor to save this code to a local file that should have the extension `.html`.

  When you are connected to the internet, double clicking this HTML file will start up your default browser and run the program. You can return to editing your original program by clicking `Restore`. (Notice that there is no need to be able to run the exported html file when disconnected from the internet, because you can run the original program in the offline package.)

### POSSIBLE SLOWDOWN
If you make a large number of runs, performance may degrade due to an accumulation of "WebGL contexts". However, there is a simple remedy: reload the web page

### IMPORT ISSUES, AND USING JAVASCRIPT
By default, if you don't specify VPython or JavaScript in the first line, it is assumed that this is a VPython program.

### USING TEXTURES OR JAVASCRIPT LIBRARIES
If you don't use textures or JavaScript libraries (using the `get_library` function), the instructions given above are adequate. If you do however use textures or JavaScript libraries, you need to follow these instructions:

For highly technical security reasons (CORS, Cross-Origin Resource Sharing), it is not possible to use textures or JavaScript libraries when offline unless you use the Chrome browser and configure Chrome in a special way.

* First, exit Chrome. Then,

    * Windows: Double click `Windows_launch_chrome.bat` in the `GlowScriptOffline` folder.
    * Mac: Double click `Mac_launch_chrome.command` in the `GlowScriptOffline` folder.
        * You may have to go to System Preferences/Security & Privacy and under the General tab specify that you want to allow it to execute now and in the future. (You may have to open the folder in a terminal and execute `chmod +x Mac_launch.command`). You only need to execute the chmod instruction once, before using `Mac_launch_chrome.command` for the first time.
    * Linux: Open a terminal in the `GlowScriptOffline` folder.
        * Execute `chmod +x Linux_launch_chrome`
        * Execute `./Linux_launch_chrome`
        * You only need to execute the `chmod` instruction once, before using `Linux_launch_chrome` for the first time

* You will see the warning, `You are using an unsupported command-line flag: --disable-web-security. Stability and security will suffer.`

* On Mac or Linux, without exiting Chrome, double click `GlowScript.html`.

* If you quit and restart Chrome, its normal security rules will be restored.

* __It is important to exit this unsafe version of Chrome before using it for regular browsing.__

* Suppose you have an image named `car.jpg` that you want to use as a texture. Create a folder adjacent to the `GlowScriptOffLine` folder and place `car.jpg` in it. Suppose you name the new folder `Mystuff`. To use the texture: `texture="../Mystuff/car.jpg"`.

* To use a library written in JavaScript, place it in your `Mystuff` folder. Suppose the library is named `useful.js`. To use it, in your program execute the statement `get_library("../Mystuff/useful.js")`.

    * The reason for putting the `Mystuff` folder outside but next to the `GlowScriptOnline` folder is that whenever you update to a later version of the online package you don't want to lose your `Mystuff` files.
