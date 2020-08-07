GlowScript
==========
GlowScript makes it easy to write programs in JavaScript or [VPython](http://vpython.org) (which uses the RapydScript compiler) that generate navigable real-time 3D animations, using the WebGL 3D graphics library available in modern browsers (with modern GPU-based graphics cards). For example, the following complete program creates a 3D canvas in the browser, displays a white 3D cube, creates default lighting, places the camera so that the cube fills the scene, and enables mouse controls to rotate and zoom the camera:

```javascript
   box()
```

That's it. That's the whole program (except for the GlowScript version header line that is supplied automatically). The key point is that lots of well-designed defaults are built into the GlowScript library. You can of course specify the canvas size, the color and other attributes of the objects, the direction of the camera view, etc.

For a history of the development of VPython, see [A time line for VPython development](https://brucesherwood.net/?p=136). Here is a technical overview of GlowScript VPython and VPython 7: [VPython Architecture](https://vpython.org/contents/VPythonArchitecture.pdf).

Documentation
-------------
At [glowscript.org](http://glowscript.org) click Help for full documentation. There is an extensive set of example programs available from the first page of glowscript.org. Programs can be created and stored at glowscript.org, but it is also possible to export a program to place on your own web page, or to use the GlowScript library without storing the program at glowscript.org. For programs stored at glowscript.org, you can share a link with someone and they can run your program simply by clicking on the link. Here is an example:

   https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bounce-VPython

GlowScript was inspired by [VPython](http://vpython.org). The project was begun in 2011 by David Scherer and Bruce Sherwood. Originally programs had to be written in JavaScript, but in November 2014 it became possible to use Python, thanks to the [RapydScript](https://github.com/atsepkov/RapydScript) Python-to-JavaScript compiler created by Alex Tsepkov. GlowScript is now using a later version, [RapydScript-ng](https://github.com/kovidgoyal/rapydscript-ng) developed by Kovid Goyal.

For information related to building the GlowScript application, see MakingNewVersion.txt in the [docs](docs) folder. Also in the [docs](docs) folder is an overview of the GlowScript architecture, [GlowScriptOverview.md](docs/GlowScriptOverview.md).

Sister Project
--------------
VPython 7 lets you run VPython programs in a Jupyter notebook or from program launchers such as IDLE or Spyder: see [vpython.org](https://vpython.org). Its development was initiated by John Coady and further developed by him, Ruth Chabay, Matt Craig, and Bruce Sherwood. The syntax is the same as GlowScript VPython, and it uses the GlowScript 3D graphics library, but VPython 7 runs with an installed standard Python, which provides access to the large number of Python modules. GlowScript VPython does not require installing any software but provides access only to libraries written in JavaScript, not to standard Python modules (it does however provide portions of Python's "random" module).
 
Run Locally
------------------
At glowscript.org, your programs are stored in the cloud and are accessible from anywhere. However, there are times when you might need to write and run programs even when disconnected from the internet.

In this repository, click GlowScriptOffline2.9.zip and download the zip file.

Unzip the GlowScriptOffline package to any convenient place on your computer.

Inside the [GlowScriptOffline](GlowScriptOffline) folder, read the README file to learn how to use the package. 
 
Run a Local Server (Py3 version)
------------------
There are two sets of instructions given here for two possible
approaches. 

1. The first, "All Docker", is quite simple, and involves only
minimal new software (just [Docker](https://www.docker.com/products/docker-desktop)). 
If you're using macOS or Linux you can run the 
local webserver and datastore all in Docker. You don't need to install
anything else. However there is a rather annoying
bug in Windows that prevents the webserver from automatically restarting when 
source files change. For this reason, if they wish to have this feature,
windows users must run a python process concurrently that tracks file
changes during development. Having said that, if you just want to try a
local webserver, and you don't care about having to restart the server
manually every time you change the source code, you can skip running 
the extra python process. This is all described below.

2. The second, "Only Datastore in Docker", requires that users also install a 
recent (e.g., 3.7+) version of python (and pip) such as that provided by 
[anaconda](https://docs.anaconda.com/anaconda/install/) 
(or [miniconda](https://docs.conda.io/en/latest/miniconda.html)), as well as
[Docker](https://www.docker.com/products/docker-desktop). This is all also described below.

### Local Server Approach (1) All Docker

First install [Docker](https://www.docker.com/products/docker-desktop. Once
installed, start the Docker process.

Next, checkout the py38-app-engine branch of the glowscript git repository:

      git clone git@github.com:vpython/glowscript.git
      cd glowscript
      git checkout py38-app-engine

(Note, you can get back to the master branch with `git checkout master` if you need to)

Then run the webserver and datastore in docker:

      docker-compose up

and then browse to: [http://localhost:8080](http://localhost:8080) to view the website. That's it! This will run in a window and show you how the
webserver is handling requests. If you'd rather run this in the background
you can use:

      docker-compose up -d

When you're finished, shut down the system with:

      docker-compose down

* P.S. If you're using windows an you want to use the "auto-restart" feature when code files change
you'll need to run the filesystem monitoring tool 
[docker-windows-volume-watcher](https://pypi.org/project/docker-windows-volume-watcher/)

      pip install docker-windows-volume-watcher

* And when you're running the glowscript server locally, in a *separate* window, execute:

      docker-volume-watcher glowscript_flask_1

* and it will take care of the rest.

### Local Server Approach (2) Only Datastore In Docker

To run a local webserver with only the datastore in Docker, but the 
webserver itself running natively you need a recent version of Python3 and pip installed. The easiest method 
is probably to install [anaconda](https://docs.anaconda.com/anaconda/install/) (or [miniconda](https://docs.conda.io/en/latest/miniconda.html), if you don't want the
GUI package manager and extra applications). Once you have that you can check out
the glowscript repository (currently the `py38-app-engine` branch) and
create a virtual environment for glowscript:

      git clone git@github.com:vpython/glowscript.git
      cd glowscript
      git checkout py38-app-engine
      python -m venv venv

This will build a virtual environment for running locally. To activiate the virtual environment:

      mac: source venv/bin/activate
      windows (power shell): ./venv/Scripts/Activate.ps1

Your terminal prompt shoudl now have a `(venv)` indicating that you have
activated the glowscript virtual environment. Before you can run glowscript the 
first time, you'll need to install dependencies into the virtual environment.
This can be done with pip:

      pip install -r requirements.txt

In order to run the local datastore emulator it's easiest to use 
[Docker](https://www.docker.com/products/docker-desktop). Download 
a version of Docker that works with your OS. To test that you've 
got docker installed OK, in the glowscript directory type:

      docker-compose -f docker-datastore.yml up

You'll see a lot of log messages, but among them you shoudl see:

      datastore_1  | [datastore] Dev App Server is now running.

In this case you're good! If not, check the error messages and
see if there are any useful clues. Good luck. 

If the datastore is running, hit ctrl-c, and then type:

      docker-compose -f docker-datastore.yml up -d

This will run the datastore in the background. 

With the datastore running, you can run the webserver by typing:

      flask run

and then browse to: [http://localhost:8080](http://localhost:8080) to view the website.

When you're finished type:

      docker-compose -f docker-datastore.yml down

To stop the background datastore emulator.

Then next time you're ready to develop, you can simply type:

      docker-compose -f docker-datastore.yml up -d

      flask run

And you'll be up and running!

For Developers
--------------
In this repository's [docs](docs/) folder is a file [GlowScriptOverview.md](docs/GlowScriptOverview.md) that describes the architecture of GlowScript in detail. For many of the current issues, the relevant part of the document is the section on Execution (run-time). To test changes it is necessary to run a local server, as is describe in the previous heading. When you want to run using recent changes, you need to choose a version 0.1 greater than the current version number, and append "dev". For example, if the current version is 2.9, the first line of a test program would be GlowScript 3.0dev VPython.

License
-------
The license is found at [LICENSE.txt](https://github.com/BruceSherwood/glowscript/blob/master/LICENSE.txt).

Early version
------------------------------------------------------------------------------
In December 2014 the original GlowScript repository was corrupted in such a way that it could not be reconstituted, but a backup that contains the history of commits is here:

   https://bitbucket.org/davidscherer/glowscript_backup/overview
