Based on the work of Vesa Lappalainen of Finland, this package makes it possible to write and run GlowScript programs even when disconnected from the internet. To obtain the latest version of this package, go to the following location and click Download, then unzip the package to any convenient place on your computer:

    https://github.com/BruceSherwood/glowscript/blob/master/GlowScriptOffline2.7.zip

Inside this folder, doubleclick GlowScript.html. This will start up your preferred browser with a simple test program.

Click Run to run the program. You can drag the vertical gray bar (nnd/or make the window wider or narrower) to arrange the code and execution regions the way you want them. Make changes to the program and click Run again. If you add a print statement a print area will appear at the right.

For security reasons, browsers are not permitted to write to your computer disk. If you want to save the changes you made, copy and paste your code to an application such as Notepad (Windows) or TextEdit (Mac) and save the file.

Click Choose File and navigate to the GlowScriptOffline folder to choose from programs in the Demos folder. If you did make changes to the sample program, you'll see a warning that you might wish to save your work before replacing it with the demo program. Similarly, when you close the browser or the browser tab, if you have modified the current program you'll be warned about saving the file.

The GlowScript documentation is included in the package and is accessible by clicking Help.

In the text editor, as in the editor at glowscript.org, select one or more lines and press TAB to indent or Shift-TAB to unindent; press Ctrl-/ to toggle commenting of the lines. At the moment, find and replace options are not yet available; you can of course copy the program to a local text editor to use find and replace.

When you download programs from glowscript.org, they are in the form of .py files whose first line is "from vpython import *". This first line is understood by the offline package, as is "GlowScript X.Y VPython" or "GlowScript X.Y JavaScript".

If you make a large number of runs, performance degrades due to an accumulation of "WebGL contexts". However, there is a simple remedy: restart the package.

For highly technical reasons (CORS, Cross-Origin Resource Sharing), it is not possible to use textures or 3D text unless you configure Chrome in a special way, as follows:

    On Windows, doubleclick start.bat in the GlowScriptOffline folder.
    On Mac, open a terminal in the GlowScriptOffline folder and execute ./Mac_launch.
    On Linux, open a terminal in the GlowScriptOffline folder and execute ./Linux_launch.
    
You will see the warning, "You are using an unsupported command-line flag: --disable-web-security. Stability and security will suffer."

    Doubleclick GlowScript.html.
    
If you quit and restart Chrome, its normal security rules will be restored.
