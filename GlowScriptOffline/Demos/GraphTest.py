from vpython import *
s = 'Test of <b><i>graphing</i></b>. Move the mouse over the graph to explore its interactivity.'
s += '<br>Drag a rectangle in the graph to zoom. Examine the icons at the upper right.'
s += '<br>Click the "Reset axes" icon to restore. Drag along the bottom or left to pan.'
oscillation = graph(title=s, xtitle='time', ytitle='value', fast=False, width=800)
funct1 = gcurve(color=color.blue, width=4, markers=True, marker_color=color.orange, label='curve')
funct2 = gvbars(delta=0.4, color=color.green, label='bars')
funct3 = gdots(color=color.red, size=6, label='dots')

for t in range(-30, 74, 1):
    rate(100)
    funct1.plot( t, 5.0+5.0*cos(-0.2*t)*exp(0.015*t) )
    funct2.plot( t, 2.0+5.0*cos(-0.1*t)*exp(0.015*t) )
    funct3.plot( t, 5.0*cos(-0.03*t)*exp(0.015*t) )
