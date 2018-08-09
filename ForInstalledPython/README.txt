Files for use of the GlowScript libaries with installed Python

The files in this folder, glow.min.js and plotly.min.js, are
prepared by running the program build_original_no_overload.py,
which uses lib/glow/vectors_no_overload.js to avoid the
operator overloading machinery that is needed by GlowScript VPython,
and which minifies lib/plotly.js, which was obtained from
https://github.com/plotly/plotly.js/dist/plotly.js and modifed
by Bruce Sherwood to work with GlowScript.

These files are to be copied into the vpython module's folder vpython_libraries.
