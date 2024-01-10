; (function () {
    "use strict";

    // CPU-based autoscaling module
    // TODO: This is messy.  Maybe we can get the GPU to do some of this and save some code *and* processor time
    
    // Autoscale.compute_autoscale is called from the render function (if canvas.autoscale is true).
    // Autoscale.compute_autoscale initializes ext and calls obj.__get_extent(ext) for each visible object.
    // For most objects, obj.__get_extent(ext) calls Autoscale.find_extent(obj, ext) to establish min and max,
    // using the function point_extent() seen immediately below.
    // Some objects (e.g. triangle) call point_extent() directly.

    function extent() { }
    $.extend(extent.prototype, {
        xmin: null,
        ymin: null,
        zmin: null,
        xmax: null,
        ymax: null,
        zmax: null,
        zx_camera: 0,
        zy_camera: 0,
        last_zx_camera: -1,
        last_zy_camera: -1,
        //find_autocenter: false,

        point_extent: function (obj, p) {
            this.xmin = Math.min(p.x, this.xmin)
            this.ymin = Math.min(p.y, this.ymin)
            this.zmin = Math.min(p.z, this.zmin)
            this.xmax = Math.max(p.x, this.xmax)
            this.ymax = Math.max(p.y, this.ymax)
            this.zmax = Math.max(p.z, this.zmax)

            obj.__xmin = Math.min(p.x, obj.__xmin)
            obj.__ymin = Math.min(p.y, obj.__ymin)
            obj.__zmin = Math.min(p.z, obj.__zmin)
            obj.__xmax = Math.max(p.x, obj.__xmax)
            obj.__ymax = Math.max(p.y, obj.__ymax)
            obj.__zmax = Math.max(p.z, obj.__zmax)
        }
    })

    var exports = {
        Autoscale: {
        	/*
            compute_autocenter: function compute_autocenter(canvas) {
                var ext = canvas.__extent
                if (!ext) ext = canvas.__extent = new extent()
                //ext.find_autocenter = true
                ext.xmin = null
                ext.ymin = null
                ext.zmin = null
                ext.xmax = null
                ext.ymax = null
                ext.zmax = null
                ext.zx_camera = 0
                ext.zy_camera = 0
                var cot_hfov = 1 / Math.tan(canvas.__fov / 2)
                ext.__cot_hfov = cot_hfov // used by extent routines
                ext.__centerx = canvas.center.x
                ext.__centery = canvas.center.y
                ext.__centerz = canvas.center.z
                var check = false
                var obj
                for (var id in canvas.__visiblePrimitives) {
                    obj = canvas.__visiblePrimitives[id]
                    check = true
                    if (canvas.__changed[obj.__id])
                        obj.__get_extent(ext)
                    else {
                        ext.xmin = Math.min(ext.xmin, obj.__xmin)
                        ext.ymin = Math.min(ext.ymin, obj.__ymin)
                        ext.zmin = Math.min(ext.zmin, obj.__zmin)
                        ext.xmax = Math.max(ext.xmax, obj.__xmax)
                        ext.ymax = Math.max(ext.ymax, obj.__ymax)
                        ext.zmax = Math.max(ext.zmax, obj.__zmax)
                    }
                }
                if (check) {
                    canvas.center = vec((ext.xmin + ext.xmax) / 2, (ext.ymin + ext.ymax) / 2, (ext.zmin + ext.zmax) / 2)
                }
                //ext.find_autocenter = false
            },
            */
            compute_autoscale: function compute_autoscale(canvas) {
                var ext = canvas.__extent
                if (!ext) ext = canvas.__extent = new extent()
                var ctrx = canvas.center.x, ctry = canvas.center.y, ctrz = canvas.center.z
                var all = canvas.__visiblePrimitives

                ext.zx_camera = 0
                ext.zy_camera = 0
                var cot_hfov = 1 / Math.tan(canvas.__fov / 2)
                ext.__cot_hfov = cot_hfov // used by extent routines
                ext.__centerx = canvas.center.x
                ext.__centery = canvas.center.y
                ext.__centerz = canvas.center.z
                var check = false
                
                var obj
                for (var id in all) {
                    obj = all[id]
                    if (obj.constructor.name == 'point') continue // extent is handled by curve
                    if (obj.constructor.name == 'points') continue // should be handled by extent of points' spheres
                    check = true
                    if (canvas.__changed[obj.__id] || obj.__zx_camera === null || obj.__zy_camera === null) {
                        obj.__get_extent(ext) // the first time, ext only has values set above
                        // here, there are xmin, xmax etc., with correct values, if didn't call find_extent
                        if (obj.__xmin === null) continue
                        var xx = Math.max(Math.abs(obj.__xmin - ctrx), Math.abs(obj.__xmax - ctrx))
                        var yy = Math.max(Math.abs(obj.__ymin - ctry), Math.abs(obj.__ymax - ctry))
                        var zz = Math.max(Math.abs(obj.__zmin - ctrz), Math.abs(obj.__zmax - ctrz))
                    	obj.__zx_camera = xx * cot_hfov + zz
                        obj.__zy_camera = yy * cot_hfov + zz
                    }
                    ext.zx_camera = Math.max(ext.zx_camera, obj.__zx_camera)
                    ext.zy_camera = Math.max(ext.zy_camera, obj.__zy_camera)
                }
                if (check) {
                    if (ext.zx_camera > ext.last_zx_camera || ext.zx_camera < ext.last_zx_camera / 3 ||
                            ext.zy_camera > ext.last_zy_camera || ext.zy_camera < ext.last_zy_camera / 3) {
                        var predicted_zy = ext.zx_camera * canvas.__height / canvas.__width
                        if (predicted_zy > ext.zy_camera) {
                            if (canvas.__width >= canvas.__height) {
                                canvas.__range = 1.1 * (canvas.__height / canvas.__width) * ext.zx_camera / cot_hfov
                            } else {
                                canvas.__range = 1.1 * ext.zx_camera / cot_hfov
                            }
                        } else {
                            if (canvas.__width >= canvas.__height) {
                                canvas.__range = 1.1 * ext.zy_camera / cot_hfov
                            } else {
                                canvas.__range = 1.1 * (canvas.__width / canvas.__height) * ext.zy_camera / cot_hfov
                            }
                        }
                        ext.last_zx_camera = ext.zx_camera
                        ext.last_zy_camera = ext.zy_camera
                    }
                }
            },

            find_extent: function find_extent(obj, ext) {
                if (obj.constructor.name == 'points') return // for points object, is handled by extent of its simple_spheres
                if ((obj.constructor.name == 'simple_sphere' || obj.constructor.name == 'vp_simple_sphere')  && obj.__pixels) {
                	// approximate bounding box by a point, since pixel points objects are small
                	for (var a=0; a<8; a++) ext.point_extent(obj, obj.__pos)
                	return
                }

                var size = obj.__size
                var sizex = size.x, sizey = size.y, sizez = size.z
                var start = obj.__pos
                if (obj.group !== null) start = start.add(obj.group.pos)
                var startx = start.x, starty = start.y, startz = start.z

                var center_pos = obj.__hasPosAtCenter
                var length
                if (center_pos)
                    length = Math.sqrt(sizex * sizex + sizey * sizey + sizez * sizez) / 2
                else
                    length = Math.sqrt(sizex * sizex + sizey * sizey / 4 + sizez * sizez / 4)
                // Quick check for whether this changed object can affect autoscaling
                var px = startx - ext.__centerx
                var py = starty - ext.__centery
                var pz = startz - ext.__centerz
                var zzx = (Math.abs(px) + length) * ext.__cot_hfov + Math.abs(pz) + length
                var zzy = (Math.abs(py) + length) * ext.__cot_hfov + Math.abs(pz) + length
                if (zzx < ext.zx_camera && zzy < ext.zy_camera) return
                var axis = obj.__axis.norm()
                var up = obj.__up.norm()
                if (center_pos) start = start.sub(axis.multiply(sizex / 2))
                var long = axis.multiply(sizex)
                var z = axis.cross(up).norm()
                if (z.dot(z) < 1e-10) {
                    z = axis.cross(vec(1, 0, 0)).norm()
                    if (z.dot(z) < 1e-10) z = axis.cross(vec(0, 1, 0)).norm()
                }
                var y = z.cross(axis)
                var pt1 = start.add(y.multiply(-sizey / 2).add(z.multiply(-sizez / 2)))
                var pt2 = pt1.add(y.multiply(sizey))
                var pt3 = pt1.add(z.multiply(sizez))
                var pt4 = pt2.add(z.multiply(sizez))
                var pt5 = pt1.add(long)
                var pt6 = pt2.add(long)
                var pt7 = pt3.add(long)
                var pt8 = pt4.add(long)

                ext.point_extent(obj, pt1)
                ext.point_extent(obj, pt2)
                ext.point_extent(obj, pt3)
                ext.point_extent(obj, pt4)
                ext.point_extent(obj, pt5)
                ext.point_extent(obj, pt6)
                ext.point_extent(obj, pt7)
                ext.point_extent(obj, pt8)
            }
        }
    }

    Export(exports)
})()
