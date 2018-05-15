OBTAINING THE LATEST VERSION OF GLOWSCRIPT OFFLINE
Based on the work of Vesa Lappalainen of Finland, this package makes it possible to write and run GlowScript programs even when disconnected from the internet. To obtain the latest version of this package, go to the following location and click Download, then unzip the package to any convenient place on your computer:

    https://github.com/BruceSherwood/glowscript/blob/master/GlowScriptOffline2.7.zip

RUNNING PROGRAMS
Inside this folder, doubleclick GlowScript.html. This will start up your preferred browser with a simple test program.

Click Run to run the program. You can drag the vertical gray bar (nnd/or make the window wider or narrower) to arrange the code and execution regions the way you want them. Make changes to the program and click Run again. If you add a print statement a print area will appear at the right.

SAVING YOUR CHANGES
For security reasons, browsers are not permitted to write to your computer disk. If you want to save the changes you made, copy and paste your code to an application such as Notepad (Windows) or TextEdit (Mac) and save the file.

DEMO PROGRAMS INCLUDED
Click Choose File and navigate to the GlowScriptOffline folder to choose from programs in the Demos folder. If you did make changes to the sample program, you'll see a warning that you might wish to save your work before replacing it with the demo program. Similarly, when you close the browser or the browser tab, if you have modified the current program you'll be warned about saving the file.

DOCUMENTATION INCLUDED
The GlowScript documentation is included in the package and is accessible by clicking Help.

USING THE TEXT EDITOR
In the text editor, as in the editor at glowscript.org, select one or more lines and press TAB to indent or Shift-TAB to unindent; press Ctrl-/ to toggle commenting of the lines. At the moment, find and replace options are not yet available; you can of course copy the program to a local text editor to use find and replace.

USING PROGRAMS FROM glowscript.org OR FROM VPYTHON 7
When you download programs from glowscript.org, they are in the form of .py files whose first line is a statement about importing vpython, like programs created with VPython 7. This first line is understood by the offline package, as is "GlowScript X.Y VPython" or "GlowScript X.Y JavaScript".

EXPORTING A PROGRAM
When you click the "Export" button, your program is processed to create code that can be used embedded in your own web site, just like using the option "Share or export this program" at glowscript.org. This processed code temporarily replaces your own program code and is selected so that you can simply press Ctrl-C to copy the code, then use a text editor to save this code to a local file that should have the extension ".html". When you are connected to the internet, doubleclicking this html file will start up your default browser and run the program. You can return to editing your orginal program by clicking the "Restore" button. (Notice that there is no need to be able to run the exported html file when disconnected from the internet, because you can run the original program in the offline package.)

POSSIBLE SLOWDOWN
If you make a large number of runs, performance degrades due to an accumulation of "WebGL contexts". However, there is a simple remedy: reload the web page.

IMPORT ISSUES
By default, if you don't start a program with a statement of the form "GlowScript 2.7 JavaScript" or "GlowScript 2.7 RapydScript", it is assumed that this is a VPython program. You can also start a program with one of these kinds of Python import statements (or include such an import statement after "GlowScript 2.7 VPython"):

    from vpython import * # The default; all VPython elements are available
    from vpython import canvas, box, sphere, vec # This MUST include canvas; box and sphere and vec are available
    import vpython        # To show a red box, say vpython.box(color=vpython.color.red)
    import vpython as vp  # To show a red box, say vp.box(color=vp.color.red)

If you don't include a GlowScript or import statement, this is the same as specifying "from vpython import *".

USING TEXTURES OR JAVASCRIPT LIBRARIES
If you don't use textures or JavaScript libraries (using the get_library function), the insructions given above are adequate. If you do however use textures or JavaScript libraries, you need to follow these instructions:

For highly technical reasons (CORS, Cross-Origin Resource Sharing), it is not possible to use textures or JavaScript libraries when offline unless you use the Chrome browser and configure Chrome in a special way. First, exit Chrome. Then,

    Windows: Doubleclick start.bat in the GlowScriptOffline folder.
    
    Mac: Doubleclick Mac_launch.command (after which you may have to go to System Preferences/Security & Privacy and
        specify that you want to allow it to execute now and in the future).
        
    Linux: Open a terminal in the GlowScriptOffline folder and execute chmod 755 Linux_launch, then doubleclick Linux_launch. 
        You only need to execute the chmod instruction once, before using Linux_launch for the first time.
    
You will see the warning, "You are using an unsupported command-line flag: --disable-web-security. Stability and security will suffer." Without exiting Chrome, do this:

    Doubleclick GlowScript.html.
    
If you quit and restart Chrome, its normal security rules will be restored.

The standard VPython textures are available in the usual way (texture=textures.flower). Suppose you have an image named car.js. Place it in the glowscript_data folder. To use it, in your program say texture="glowscript_data/car.js".

To use a library written in JavaScript, place it in the glowscript_libraries folder. Suppose the library is named useful.js. To use it, in your program execute the statement get_library("glowscript_libraries/useful.js").
