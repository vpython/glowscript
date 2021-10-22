;(function () {
    "use strict";

    var glowscript = { version: "3.2" }

    // GlowScript uses lots of javascript properties (Object.defineProperty) with getters and setters
    // This is an attempt to create a more declarative syntax for declaring an object with lots of properties

    // This file also exports a function Export() which is used by all other glowscript modules to export their
    // symbols.  At present the symbols go both into window and window.glowscript objects.

    /* Example:
    function myClass() {}
    property.declare( myClass.prototype, {
    // By default, properties are writable, but are forced to have the same type they have initially
    // Each one gets a corresponding data property (e.g. __name) that should be used with great care
    x:0, y:0, z:0,
    name: "Me",

    // Properties starting with __ are non-enumerable and not typechecked
    __hidden = 57,

    // Derived properties can be read-only or read-write
    length: { get: function() { return this.x+this.y+this.z } },
    x_plus_one: { get: function() { return this.x+1 }, set: function(value) { this.x = value-1 } ),

    // onchanged lets a property work as normal (including typechecking) but trigger a function after being modified
    title: { value: "Mr.", onchanged: function() { console.log("Now you are " + this.title + " " + this.name + "!") } },

    // You can make a property read only by setting readonly to true.  It can be changed via __whatever
    salary: { value: 0, readonly: true },

    // You can also turn off typechecking by setting type to null, or force a particular type check by setting it
    anything: { value: null, type: null },
    number: { value: 0, type: Number },
    short: { value: "", type: function(x) { if (typeof x !== "string" || x.length>8) throw new Error("Not a string"); return x; } }
    } )
    */

    var property = {
        declare: function (proto, propertyMap) {
            $.each(propertyMap, function (name, definition) {
                if (definition === null || (definition.value===undefined && !definition.get))
                    definition = { value: definition }
                definition.name = name
                var internal = definition.internal || name.substr(0, 2) === "__"
                if (definition.enumerable === undefined)
                    definition.enumerable = !internal
                if (definition.type === undefined && !definition.get && !internal) {
                    var tp = typeof definition.value
                    if (tp === "number")
                        definition.type = property.check_number
                    else if (tp === "string")
                        definition.type = property.check_string
                    else if (definition.value instanceof attributeVector)
                        definition.type = property.check_attributeVector
                    else if (definition.value instanceof attributeVectorPos)
                        definition.type = property.check_attributeVectorPos
                    else if (definition.value instanceof attributeVectorAxis)
                        definition.type = property.check_attributeVectorAxis
                    else if (definition.value instanceof attributeVectorSize)
                        definition.type = property.check_attributeVectorSize
                    else if (definition.value instanceof attributeVectorUp)
                        definition.type = property.check_attributeVectorUp
                    else if (definition.value instanceof vec)
                        definition.type = property.check_vec
                }

                if ((definition.readonly && definition.set) ||
                    (definition.onchanged && definition.set) ||
                    (definition.value !== undefined && definition.get))
                    throw new Error("Erroneous property definition '" + name + "'.")

                function readOnlyError() { throw new Error("Property '" + name + "' is read-only.") }

                //console.log("property", proto.constructor.name, name, definition, proto)

                if (definition.get) {
                    Object.defineProperty(proto, name, { enumerable: definition.enumerable, get: definition.get, set: definition.set || readOnlyError })
                } else {
                    // If no typechecking, we just define a plain jane data descriptor
                    if (!definition.type && !definition.onchanged)
                        Object.defineProperty(proto, name, { enumerable: definition.enumerable, writable: !definition.readonly, value: definition.value })
                    else { 
                        var internalName = "__" + name
                        var prop = {
                            enumerable: definition.enumerable,
                            get: function () { return this[internalName] }
                        }

                        if (definition.set)
                            prop.set = definition.set
                        else if (definition.onchanged && definition.type)
                            prop.set = function (val) { var old = this[internalName]; this[internalName] = definition.type.call(this, val, definition); definition.onchanged.call(this, old) }
                        else if (definition.onchanged)
                            prop.set = function (val) { var old = this[internalName]; this[internalName] = val; definition.onchanged.call(this, old) }
                        else if (definition.type)
                            prop.set = function (val) { this[internalName] = definition.type.call(this, val, definition) }
                        /*else
                        prop.set = function (val) { this[internalName] = val; }*/

                        Object.defineProperty(proto, internalName, { enumerable: false, writable: true, value: definition.value })
                        Object.defineProperty(proto, name, prop)
                    }
                }
            })
        },
        nullable_attributeVector: function nullable_attributeVector(v, def) {
            if (v === null) return null
            return property.check_attributeVector.call(this, v, def)
        },
        check_attributeVector: function check_attributeVector(v, def) {
            if (!(v instanceof vec)) throw new Error("Property '" + def.name + "' must be a vector.");
            return new attributeVector( this, v.x, v.y, v.z )
        },
        check_attributeVectorPos: function check_attributeVectorPos(v, def) {
            if (!(v instanceof vec)) throw new Error("Property '" + def.name + "' must be a vector.");
            return new attributeVectorPos( this, v.x, v.y, v.z )
        },
        check_attributeVectorAxis: function check_attributeVectorAxis(v, def) {
            if (!(v instanceof vec)) throw new Error("Property '" + def.name + "' must be a vector.");
            return new attributeVectorAxis( this, v.x, v.y, v.z )
        },
        check_attributeVectorSize: function check_attributeVectorSize(v, def) {
            if (!(v instanceof vec)) throw new Error("Property '" + def.name + "' must be a vector.");
            return new attributeVectorSize( this, v.x, v.y, v.z )
        },
        check_attributeVectorUp: function check_attributeVectorUp(v, def) {
            if (!(v instanceof vec)) throw new Error("Property '" + def.name + "' must be a vector.");
            return new attributeVectorUp( this, v.x, v.y, v.z )
        },
        check_vec: function check_vec(v, def) { 
            if (!(v instanceof vec)) throw new Error("Property '" + def.name + "' must be a vector."); 
            return v; 
        },
        check_number: function check_number(v, def) { return v; },
        check_string: function check_string(v, def) { return v; },
    }

    var global = window
    function Export( exports ) {
        for(var id in exports) {
            glowscript[id] = exports[id]
            global[id] = exports[id]
        }
    }

    var module_exports = {
        glowscript: glowscript,
        property: property,
        Export: Export
    }
    Export(module_exports)
})()
