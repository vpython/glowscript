
const fs = require('fs');

/*
** Stand alone nodejs script to compile a GlowScript program and output the HTML
*/

global.window = {}
global.RS = require('./package/RScompiler.3.2.min.js')
global.RapydScript = RS.RapydScript; // script assumes RapydScript is gobal for some reason
//debugger;

function inlineHTML(source) {
    // This function is used to inline the source code in the HTML
    // It replaces newlines with <br> and escapes double quotes
    // source = "Web VPython 3.2\n\n\nball=sphere()"

    var header = {
        "version": "3.2",
        "lang": "vpython",
        "nodictionary": false,
        "source": source,
        "ok": "3.2",
        "unpackaged": false,
        "isCurrent": true
    }

    var embedHTML = '' // Will be an ampty string if there is a compile error
    var embedScript = window.glowscript_compile(header.source,
                {lang: header.lang, version: header.version.substr(0,3), 
                run: false, nodictionary: header.nodictionary})
    // console.log('ide 1343', embedScript)
    var divid = "glowscript"
    var main
    var v = Number(header.version.substr(0,3))
    if (v >= 2.9) main = '__main__()' // Starting August 2019, no longer using Streamine
    var remove = header.version==='0.3' ? '' : '.removeAttr("id")'

    embedScript = ";(function() {" + embedScript + '\n;$(function(){ window.__context = { glowscript_container: $("#' + divid + '")'+remove+' }; '+main+' })})()'
    embedScript = embedScript.replace("</", "<\/") // escape anything that could be a close script tag... hopefully this sequence only occurs in strings!
    var verdir = "bef1.1"
    if (v == 1.1) verdir = "1.1"
    else if (v >= 2.2) verdir = "2.1"
    else verdir = header.version.substr(0,3)
    var runner = ''
    var exporturl = "https://www.glowscript.org/"
    if (v >= 2.5 && v < 3.0) exporturl = "https://s3.amazonaws.com/glowscript/"
    // Note: some already exported 3.0 programs contain references to s3.amazonaws.com
    if (header.lang == 'vpython') 
        runner = '<script type="text/javascript" src="'+exporturl+'package/RSrun.' + header.version + '.min.js"></script>\n'
    embedHTML = ( // embedHTML is a var introduced above to make it easy for downloadHTML
        '<div id="' + divid + '" class="glowscript">\n' + 
        '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n' + 
        '<link type="text/css" href="'+exporturl+'css/redmond/' + verdir + '/jquery-ui.custom.css" rel="stylesheet" />\n' + 
        '<link type="text/css" href="'+exporturl+'css/ide.css" rel="stylesheet" />\n' + 
        '<script type="text/javascript" src="'+exporturl+'lib/jquery/' + verdir + '/jquery.min.js"></script>\n' + 
        '<script type="text/javascript" src="'+exporturl+'lib/jquery/' + verdir + '/jquery-ui.custom.min.js"></script>\n' + 
        '<script type="text/javascript" src="'+exporturl+'package/glow.' + header.version + '.min.js"></script>\n' + 
        runner +
        '<script type="text/javascript"><!--//--><![CDATA[//><!--\n\n// START JAVASCRIPT\n' + 
        embedScript + '\n// END JAVASCRIPT\n' + 
        '\n//--><!]]></script>' + 
        '\n</div>');

    return embedHTML
}

function doCheck(source) {
    // This function checks the source code and returns an object with the result
    var result = {ok: true, message: '', html: ''};
    try {
        var html = inlineHTML(source);
        result.html = html;
    } catch (e) {
        result.ok = false;
        result.message = e.message;
    }
    return result;
}

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node convert.js <path_to_python_file>');
    process.exit(1);
}

fs.readFile(filePath, 'utf8', (err, source) => {
    if (err) {
        console.error(`Error reading file: ${err}`);
        process.exit(1);
    }

    const result = doCheck(source);

    if (result.ok) {
        console.log(result.html);
    } else {
        console.error(result.message);
        process.exit(1);
    }
});
