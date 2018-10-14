from vpython import *
#GlowScript 2.7 VPython
# Using LaTeX to display mathematical expressions.
scene.width = scene.height = 300
box()
scene.title = "\\(\\dfrac {5} {7} \\)"
scene.caption = "Final kinetic energy = \\(\\dfrac {1} {2}mv_i^{2}+\\int _{i}^{f}\\vec{F}\\circ d \\vec{r} \\)"
MathJax.Hub.Queue(["Typeset",MathJax.Hub])
L = label(text='Click to change the title above')
scene.append_to_caption("<br><br>See the <a href='http://www.glowscript.org/docs/VPythonDocs/MathJax.html' target=_blank><b>documentation</b></a> on how to use this.")
scene.waitfor('click')

L.visible = False
scene.title = "\\(\\dfrac {3y} {4x} \\)"
MathJax.Hub.Queue(["Typeset",MathJax.Hub,scene.title])