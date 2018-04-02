GlowScript
==========
GlowScript makes it easy to write programs in JavaScript, [RapydScript](https://github.com/kovidgoyal/rapydscript-ng) (a Python look-alike that compiles Python to JavaScript), or [VPython](http://vpython.org) (which uses the RapydScript compiler) that generate navigable real-time 3D animations, using the WebGL 3D graphics library available in modern browsers (with modern GPU-based graphics cards). For example, the following complete program creates a 3D canvas in the browser, displays a white 3D cube, creates default lighting, places the camera so that the cube fills the scene, and enables mouse controls to rotate and zoom the camera:

```javascript
   box()
```

That's it. That's the whole program (except for the GlowScript version header line that is supplied automatically). The key point is that lots of sensible defaults are built into the GlowScript library. You can of course specify the canvas size, the color and other attributes of the objects, the direction of the camera view, etc.

Documentation
-------------
At [glowscript.org](http://glowscript.org) click Help for full documentation. There is an extensive set of example programs available from the first page of glowscript.org. Programs can be created and stored at glowscript.org, but it is also possible to export a program to place on your own web page, or to use the GlowScript library without storing the program at glowscript.org. For programs stored at glowscript.org, you can share a link with someone and they can run your program simply by clicking on the link. Here is an example:

   http://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bounce-VPython

GlowScript was inspired by [VPython](http://vpython.org). The project was begun in 2011 by David Scherer and Bruce Sherwood. Originally programs had to be written in JavaScript, but in November 2014 it became possible to use Python, thanks to the [RapydScript](https://github.com/atsepkov/RapydScript) Python-to-JavaScript compiler created by Alex Tsepkov. GlowScript is now using a later version, [RapydScript-ng](https://github.com/kovidgoyal/rapydscript-ng) developed by Kovid Goyal.

For information related to building the GlowScript application, see MakingNewVersion.txt in the docs folder.

Sister Project
--------------
A more recent project, VPython 7, was initiated by John Coady and further developed by Ruth Chabay and Bruce Sherwood. VPython 7 lets you run VPython programs in a Jupyter notebook or from program launchers such as IDLE or Spyder: see [vpython.org](http://vpython.org). The syntax is the same as GlowScript VPython, but VPython 7 uses an installed standard Python, which provides access to the large number of Python modules. GlowScript VPython does not require installing any software but provides access only to libraries written in JavaScript, not to standard Python modules.
 
Run Locally
------------------
It is possible to write and run GlowScript programs without an internet connection. Click the GlowScriptOffline zip file listed above and download it. Unzip the contents to a convenient location. In the GlowScriptOffline folder, doubleclick GlowScript.html, which will start up your standard browser with a simple test program. Click Run to run the program. You can drag the vertical gray bar (and/or make the window wider or narrower) to arrange the code and execution regions the way you want them. Make changes to the program and click Run again. If you add a print statement a print area will appear at the right. For security reasons, browsers are not permitted to write to your computer disk. If you want to save the changes you made, copy and paste your code to an application such as Notepad (Windows) or TextEdit (Mac) and save the file. The GlowScript documentation is included in the package and is accessible by clicking Help.

Click Choose File and navigate to the GlowScriptOffline folder to choose from programs in the Demos folder. If you did make changes to the sample program, you'll see a warning that you might wish to save your work before replacing it with the demo program. Similarly, when you close the browser or the browser tab, if you have modified the current program you'll be warned about saving the file.

In the text editor, as in the editor at glowscript.org, select one or more lines and press TAB to indent or Shift-TAB to unindent; press Ctrl-/ to toggle commenting of the lines. When you download programs from glowscript.org, they are in the form of .py files whose first line is "from vpython import *".

This first line is understood by the offline package, as is "GlowScript 2.7 VPython" or "GlowScript 2.7 JavaScript".
 
Run a Local Server
------------------
This repository is a Google App Engine application. Here are instructions for running locally, using a local server (this is much more complicated than running locally as described under the previous heading):

   http://www.glowscript.org/docs/GlowScriptDocs/local.html

License
-------
The license is found at [LICENSE.txt](https://github.com/BruceSherwood/glowscript/blob/master/LICENSE.txt).

Early version
------------------------------------------------------------------------------
In December 2014 the original GlowScript repository was corrupted in such a way that it could not be reconstituted, but a backup that contains the history of commits is here:

   https://bitbucket.org/davidscherer/glowscript_backup/overview
