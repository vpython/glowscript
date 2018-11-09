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
At glowscript.org, your programs are stored in the cloud and are accessible from anywhere. However, there are times when you might need to write and run programs even when disconnected from the internet.

In this repository, click GlowScriptOffline2.7.zip and download the zip file.

Unzip the GlowScriptOffline package to any convenient place on your computer.

Inside the GlowScriptOffline folder, read the README file to learn how to use the package. 
 
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
