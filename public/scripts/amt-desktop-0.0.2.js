/* eslint-disable */

/** 
* @description Remote Desktop
* @author Ylian Saint-Hilaire
* @version v0.0.2g
*/

import { Q, QS, ReadInt, ReadShort, IntToStr, ShortToStr } from './common-0.0.1'
import { ZLIB } from './zlib-inflate'

// Construct a MeshServer object
var CreateAmtRemoteDesktop = function (divid, scrolldiv) {
    var obj = {};
    obj.canvasid = divid;
    obj.CanvasId = Q(divid);
    obj.scrolldiv = scrolldiv;
    obj.canvas = Q(divid).getContext("2d");
    obj.protocol = 2; // KVM
    obj.state = 0;
    obj.acc = "";
    obj.ScreenWidth = 960;
    obj.ScreenHeight = 700;
    obj.width = 0;
    obj.height = 0;
    obj.rwidth = 0;
    obj.rheight = 0;
    obj.bpp = 2; // Bytes per pixel (1 or 2 supported)
    obj.useZRLE = true;
    obj.showmouse = true;
    obj.buttonmask = 0;
    //obj.inbytes = 0;
    //obj.outbytes = 0;
    obj.spare = null;
    obj.sparew = 0;
    obj.spareh = 0;
    obj.sparew2 = 0;
    obj.spareh2 = 0;
    obj.sparecache = {};
    obj.ZRLEfirst = 1;
    obj.onScreenSizeChange = null;
    obj.frameRateDelay = 0;
    // ###BEGIN###{DesktopRotation}
    obj.noMouseRotate = false;
    obj.rotation = 0;
    // ###END###{DesktopRotation}

    // ###BEGIN###{DesktopFocus}
    obj.mx = 0; // Last mouse x position
    obj.my = 0; // Last mouse y position
    obj.ox = -1; // Old mouse x position
    obj.oy = -1; // Old mouse y position
    obj.focusmode = 0;
    // ###END###{DesktopFocus}
    // ###BEGIN###{Inflate}
    obj.inflate = ZLIB.inflateInit(-15);
    // ###END###{Inflate}

    // Private method
    obj.Debug = function (msg) { console.log(msg); }

    obj.xxStateChange = function (newstate) {
        if (newstate == 0) {
            obj.canvas.fillStyle = '#000000';
            obj.canvas.fillRect(0, 0, obj.width, obj.height);
            obj.canvas.canvas.width = obj.rwidth = obj.width = 640;
            obj.canvas.canvas.height = obj.rheight = obj.height = 400;
            QS(obj.canvasid).cursor = 'auto';
        } else {
            if (!obj.showmouse) { QS(obj.canvasid).cursor = 'none'; }
        }
    }

    obj.ProcessData = function (data) {
        if (!data) return;
        // obj.Debug("KRecv(" + data.length + "): " + rstr2hex(data));
        //obj.inbytes += data.length;
        //obj.Debug("KRecv(" + obj.inbytes + ")");
        obj.acc += data;
        while (obj.acc.length > 0) {
            //obj.Debug("KAcc(" + obj.acc.length + "): " + rstr2hex(obj.acc));
            var cmdsize = 0;
            if (obj.state == 0 && obj.acc.length >= 12) {
                // Getting handshake & version
                cmdsize = 12;
                //if (obj.acc.substring(0, 4) != "RFB ") { return obj.Stop(); }
                //var version = parseFloat(obj.acc.substring(4, 11));
                //obj.Debug("KVersion: " + version);
                obj.state = 1;
                obj.send("RFB 003.008\n");
            }
            else if (obj.state == 1 && obj.acc.length >= 1) {
                // Getting security options
                cmdsize = obj.acc.charCodeAt(0) + 1;
                obj.send(String.fromCharCode(1)); // Send the "None" security type. Since we already authenticated using redirection digest auth, we don't need to do this again.
                obj.state = 2;
            }
            else if (obj.state == 2 && obj.acc.length >= 4) {
                // Getting security response
                cmdsize = 4;
                if (ReadInt(obj.acc, 0) != 0) { return obj.Stop(); }
                obj.send(String.fromCharCode(1)); // Send share desktop flag
                obj.state = 3;
            }
            else if (obj.state == 3 && obj.acc.length >= 24) {
                // Getting server init
                // ###BEGIN###{DesktopRotation}
                obj.rotation = 0; // We don't currently support screen init while rotated.
                // ###END###{DesktopRotation}
                var namelen = ReadInt(obj.acc, 20);
                if (obj.acc.length < 24 + namelen) return;
                cmdsize = 24 + namelen;
                obj.canvas.canvas.width = obj.rwidth = obj.width = obj.ScreenWidth = ReadShort(obj.acc, 0);
                obj.canvas.canvas.height = obj.rheight = obj.height = obj.ScreenHeight = ReadShort(obj.acc, 2);

                // These are all values we don't really need, we are going to only run in RGB565 or RGB332 and not use the flexibility provided by these settings.
                // Makes the javascript code smaller and maybe a bit faster.
                /*
                obj.xbpp = obj.acc.charCodeAt(4);
                obj.depth = obj.acc.charCodeAt(5);
                obj.bigend = obj.acc.charCodeAt(6);
                obj.truecolor = obj.acc.charCodeAt(7);
                obj.rmax = ReadShort(obj.acc, 8);
                obj.gmax = ReadShort(obj.acc, 10);
                obj.bmax = ReadShort(obj.acc, 12);
                obj.rsh = obj.acc.charCodeAt(14);
                obj.gsh = obj.acc.charCodeAt(15);
                obj.bsh = obj.acc.charCodeAt(16);
                var name = obj.acc.substring(24, 24 + namelen);
                obj.Debug("name: " + name);
                obj.Debug("width: " + obj.width + ", height: " + obj.height);
                obj.Debug("bits-per-pixel: " + obj.xbpp);
                obj.Debug("depth: " + obj.depth);
                obj.Debug("big-endian-flag: " + obj.bigend);
                obj.Debug("true-colour-flag: " + obj.truecolor);
                obj.Debug("rgb max: " + obj.rmax + "," + obj.gmax + "," + obj.bmax);
                obj.Debug("rgb shift: " + obj.rsh + "," + obj.gsh + "," + obj.bsh);
                */

                // SetEncodings, with AMT we can't omit RAW, must be specified.
                // Intel AMT supports encodings: RAW (0), ZRLE (16), Desktop Size (0xFFFFFF21, -223)

                var supportedEncodings = '';
                if (obj.useZRLE) supportedEncodings += IntToStr(16);
                supportedEncodings += IntToStr(0);

                obj.send(String.fromCharCode(2, 0) + ShortToStr((supportedEncodings.length / 4) + 1) + supportedEncodings + IntToStr(-223));          // Supported Encodings + Desktop Size

                // Set the pixel encoding to something much smaller
                // obj.send(String.fromCharCode(0, 0, 0, 0, 16, 16, 0, 1) + ShortToStr(31) + ShortToStr(63) + ShortToStr(31) + String.fromCharCode(11, 5, 0, 0, 0, 0));                     // Setup 16 bit color RGB565 (This is the default, so we don't need to set it)
                if (obj.bpp == 1) obj.send(String.fromCharCode(0, 0, 0, 0, 8, 8, 0, 1) + ShortToStr(7) + ShortToStr(7) + ShortToStr(3) + String.fromCharCode(5, 2, 0, 0, 0, 0));            // Setup 8 bit color RGB332

                obj.state = 4;
                obj.parent.xxStateChange(3);
                _SendRefresh();
                //obj.timer = setInterval(obj.xxOnTimer, 50);

                // ###BEGIN###{DesktopFocus}
                obj.ox = -1; // Old mouse x position
                // ###END###{DesktopFocus}

                if (obj.onScreenSizeChange != null) { obj.onScreenSizeChange(obj, obj.ScreenWidth, obj.ScreenHeight); }
            }
            else if (obj.state == 4) {
                var c = obj.acc.charCodeAt(0);
                if (c == 2) {
                    cmdsize = 1;                                // This is the bell, do nothing.
                } else if (c == 0) {
                    if (obj.acc.length < 4) return;
                    obj.state = 100 + ReadShort(obj.acc, 2);    // Read the number of tiles that are going to be sent, add 100 and use that as our protocol state.
                    cmdsize = 4;
                }
            }
            else if (obj.state > 100 && obj.acc.length >= 12) {
                var x = ReadShort(obj.acc, 0),
                    y = ReadShort(obj.acc, 2),
                    width = ReadShort(obj.acc, 4),
                    height = ReadShort(obj.acc, 6),
                    s = width * height,
                    encoding = ReadInt(obj.acc, 8);

                if (encoding < 17) {
                    if (width < 1 || width > 64 || height < 1 || height > 64) { console.log("Invalid tile size (" + width + "," + height + "), disconnecting."); return obj.Stop(); }

                    // Set the spare bitmap to the rigth size if it's not already. This allows us to recycle the spare most if not all the time.
                    if (obj.sparew != width || obj.spareh != height) {
                        obj.sparew = obj.sparew2 = width;
                        obj.spareh = obj.spareh2 = height;
                        // ###BEGIN###{DesktopRotation}
                        if (obj.rotation == 1 || obj.rotation == 3) { obj.sparew2 = height, obj.spareh2 = width; }
                        // ###END###{DesktopRotation}
                        var xspacecachename = obj.sparew2 + 'x' + obj.spareh2;
                        obj.spare = obj.sparecache[xspacecachename];
                        if (!obj.spare) { obj.sparecache[xspacecachename] = obj.spare = obj.canvas.createImageData(obj.sparew2, obj.spareh2); }
                    }

                }

                if (encoding == 0xFFFFFF21) {
                    // Desktop Size (0xFFFFFF21, -223)
                    obj.canvas.canvas.width = obj.rwidth = obj.width = width;
                    obj.canvas.canvas.height = obj.rheight = obj.height = height;
                    obj.send(String.fromCharCode(3, 0, 0, 0, 0, 0) + ShortToStr(obj.width) + ShortToStr(obj.height)); // FramebufferUpdateRequest
                    cmdsize = 12;
                    if (obj.onScreenSizeChange != null) { obj.onScreenSizeChange(obj, obj.ScreenWidth, obj.ScreenHeight); }
                    // obj.Debug("New desktop width: " + obj.width + ", height: " + obj.height);
                }
                else if (encoding == 0) {
                    // RAW encoding
                    var ptr = 12, cs = 12 + (s * obj.bpp);
                    if (obj.acc.length < cs) return; // Check we have all the data needed and we can only draw 64x64 tiles.
                    cmdsize = cs;

                    // CRITICAL LOOP, optimize this as much as possible
                    for (var i = 0; i < s; i++) { _setPixel(obj.acc.charCodeAt(ptr++) + ((obj.bpp == 2) ? (obj.acc.charCodeAt(ptr++) << 8) : 0), i); }
                    _putImage(obj.spare, x, y);
                }
                else if (encoding == 16) {
                    // ZRLE encoding
                    if (obj.acc.length < 16) return;
                    var datalen = ReadInt(obj.acc, 12);
                    if (obj.acc.length < (16 + datalen)) return;
                    //obj.Debug("RECT ZRLE (" + x + "," + y + "," + width + "," + height + ") LEN = " + datalen);
                    //obj.Debug("RECT ZRLE LEN: " + ReadShortX(obj.acc, 17) + ", DATA: " + rstr2hex(obj.acc.substring(16)));

                    // Process the ZLib header if this is the first block
                    var ptr = 16, delta = 5, dx = 0;

                    if (datalen > 5 && obj.acc.charCodeAt(ptr) == 0 && ReadShortX(obj.acc, ptr + 1) == (datalen - delta)) {
                        // This is an uncompressed ZLib data block
                        _decodeLRE(obj.acc, ptr + 5, x, y, width, height, s, datalen);
                    }
                    // ###BEGIN###{Inflate}
                    else {
                        // This is compressed ZLib data, decompress and process it.
                        var arr = obj.inflate.inflate(obj.acc.substring(ptr, ptr + datalen - dx));
                        if (arr.length > 0) { _decodeLRE(arr, 0, x, y, width, height, s, arr.length); } else { obj.Debug("Invalid deflate data"); }
                    }
                    // ###END###{Inflate}

                    cmdsize = 16 + datalen;
                }
                else {
                    obj.Debug("Unknown Encoding: " + encoding);
                    return obj.Stop();
                }
                if (--obj.state == 100) {
                    obj.state = 4;
                    if (obj.frameRateDelay == 0) {
                        _SendRefresh(); // Ask for new frame
                    } else {
                        setTimeout(_SendRefresh, obj.frameRateDelay); // Hold x miliseconds before asking for a new frame
                    }
                }
            }

            if (cmdsize == 0) return;
            obj.acc = obj.acc.substring(cmdsize);
        }
    }

    function _decodeLRE(data, ptr, x, y, width, height, s, datalen) {
        var subencoding = data.charCodeAt(ptr++), index, v, runlengthdecode, palette = {}, rlecount = 0, runlength = 0, i;
        // obj.Debug("RECT RLE (" + (datalen - 5) + ", " + subencoding + "):" + rstr2hex(data.substring(21, 21 + (datalen - 5))));
        if (subencoding == 0) {
            // RAW encoding
            for (i = 0; i < s; i++) { _setPixel(data.charCodeAt(ptr++) + ((obj.bpp == 2) ? (data.charCodeAt(ptr++) << 8) : 0), i); }
            _putImage(obj.spare, x, y);
        }
        else if (subencoding == 1) {
            // Solid color tile
            v = data.charCodeAt(ptr++) + ((obj.bpp == 2) ? (data.charCodeAt(ptr++) << 8) : 0);
            obj.canvas.fillStyle = 'rgb(' + ((obj.bpp == 1) ? ((v & 224) + ',' + ((v & 28) << 3) + ',' + _fixColor((v & 3) << 6)) : (((v >> 8) & 248) + ',' + ((v >> 3) & 252) + ',' + ((v & 31) << 3))) + ')';

            // ###BEGIN###{DesktopRotation}
            var xx = _rotX(x, y);
            y = _rotY(x, y);
            x = xx;
            // ###END###{DesktopRotation}

            obj.canvas.fillRect(x, y, width, height);
        }
        else if (subencoding > 1 && subencoding < 17) { // Packed palette encoded tile
            // Read the palette
            var br = 4, bm = 15; // br is BitRead and bm is BitMask. By adjusting these two we can support all the variations in this encoding.
            for (i = 0; i < subencoding; i++) { palette[i] = data.charCodeAt(ptr++) + ((obj.bpp == 2) ? (data.charCodeAt(ptr++) << 8) : 0); }

            // Compute bits to read & bit mark
            if (subencoding == 2) { br = 1; bm = 1; } else if (subencoding <= 4) { br = 2; bm = 3; }

            // Display all the bits
            while (rlecount < s && ptr < data.length) { v = data.charCodeAt(ptr++); for (i = (8 - br) ; i >= 0; i -= br) { _setPixel(palette[(v >> i) & bm], rlecount++); } }
            _putImage(obj.spare, x, y);
        }
        else if (subencoding == 128) { // RLE encoded tile
            while (rlecount < s && ptr < data.length) {
                // Get the run color
                v = data.charCodeAt(ptr++) + ((obj.bpp == 2) ? (data.charCodeAt(ptr++) << 8) : 0);

                // Decode the run length. This is the fastest and most compact way I found to do this.
                runlength = 1; do { runlength += (runlengthdecode = data.charCodeAt(ptr++)); } while (runlengthdecode == 255);

                // Draw a run
                while (--runlength >= 0) { _setPixel(v, rlecount++); }
            }
            _putImage(obj.spare, x, y);
        }
        else if (subencoding > 129) { // Palette RLE encoded tile
            // Read the palette
            for (i = 0; i < (subencoding - 128) ; i++) { palette[i] = data.charCodeAt(ptr++) + ((obj.bpp == 2) ? (data.charCodeAt(ptr++) << 8) : 0); }

            // Decode RLE  on palette
            while (rlecount < s && ptr < data.length) {
                // Setup the run, get the color index and get the color from the palette.
                runlength = 1; index = data.charCodeAt(ptr++); v = palette[index % 128];

                // If the index starts with high order bit 1, this is a run and decode the run length.
                if (index > 127) { do { runlength += (runlengthdecode = data.charCodeAt(ptr++)); } while (runlengthdecode == 255); }

                // Draw a run
                while (--runlength >= 0) { _setPixel(v, rlecount++); }
            }
            _putImage(obj.spare, x, y);
        }
    }

    function _putImage(i, x, y) {
        // ###BEGIN###{DesktopRotation}
        var xx = _arotX(x, y);
        y = _arotY(x, y);
        x = xx;
        // ###END###{DesktopRotation}
        obj.canvas.putImageData(i, x, y);
    }

    function _setPixel(v, p) {
        var pp = p * 4;

        // ###BEGIN###{DesktopRotation}
        if (obj.rotation > 0) {
            if (obj.rotation == 1) {
                var x = p % obj.sparew;
                var y = Math.floor(p / obj.sparew);
                p = (x * obj.sparew2) + (obj.sparew2 - 1 - y);
                pp = p * 4;
            }
            else if (obj.rotation == 2) { pp = (obj.sparew * obj.spareh * 4) - 4 - pp; }
            else if (obj.rotation == 3) {
                var x = p % obj.sparew;
                var y = Math.floor(p / obj.sparew);
                p = ((obj.sparew2 - 1 - x) * obj.sparew2) + (y);
                pp = p * 4;
            }
        }
        // ###END###{DesktopRotation}

        if (obj.bpp == 1) {
            // Set 8bit color RGB332
            obj.spare.data[pp++] = v & 224;
            obj.spare.data[pp++] = (v & 28) << 3;
            obj.spare.data[pp++] = _fixColor((v & 3) << 6);
        } else {
            // Set 16bit color RGB565
            obj.spare.data[pp++] = (v >> 8) & 248;
            obj.spare.data[pp++] = (v >> 3) & 252;
            obj.spare.data[pp++] = (v & 31) << 3;
        }
        obj.spare.data[pp] = 0xFF; // Set alpha channel to opaque.
    }

    // ###BEGIN###{DesktopRotation}
    function _arotX(x, y) {
        if (obj.rotation == 0) return x;
        if (obj.rotation == 1) return obj.canvas.canvas.width - obj.sparew2 - y;
        if (obj.rotation == 2) return obj.canvas.canvas.width - obj.sparew2 - x;
        if (obj.rotation == 3) return y;
        return 0;
    }

    function _arotY(x, y) {
        if (obj.rotation == 0) return y;
        if (obj.rotation == 1) return x;
        if (obj.rotation == 2) return obj.canvas.canvas.height - obj.spareh2 - y;
        if (obj.rotation == 3) return obj.canvas.canvas.height - obj.spareh - x;
        return 0;
    }

    function _crotX(x, y) {
        if (obj.rotation == 0) return x;
        if (obj.rotation == 1) return y;
        if (obj.rotation == 2) return obj.canvas.canvas.width - x;
        if (obj.rotation == 3) return obj.canvas.canvas.height - y;
        return 0;
    }

    function _crotY(x, y) {
        if (obj.rotation == 0) return y;
        if (obj.rotation == 1) return obj.canvas.canvas.width - x;
        if (obj.rotation == 2) return obj.canvas.canvas.height - y;
        if (obj.rotation == 3) return x;
        return 0;
    }

    function _rotX(x, y) {
        if (obj.rotation == 0) return x;
        if (obj.rotation == 1) return x;
        if (obj.rotation == 2) return x - obj.canvas.canvas.width;
        if (obj.rotation == 3) return x - obj.canvas.canvas.height;
        return 0;
    }

    function _rotY(x, y) {
        if (obj.rotation == 0) return y;
        if (obj.rotation == 1) return y - obj.canvas.canvas.width;
        if (obj.rotation == 2) return y - obj.canvas.canvas.height;
        if (obj.rotation == 3) return y;
        return 0;
    }

    obj.tcanvas = null;
    obj.setRotation = function (x) {
        while (x < 0) { x += 4; }
        var newrotation = x % 4;
        if (newrotation == obj.rotation) return true;
        var rw = obj.canvas.canvas.width;
        var rh = obj.canvas.canvas.height;
        if (obj.rotation == 1 || obj.rotation == 3) { rw = obj.canvas.canvas.height; rh = obj.canvas.canvas.width; }

        // Copy the canvas, put it back in the correct direction
        if (obj.tcanvas == null) obj.tcanvas = document.createElement('canvas');
        var tcanvasctx = obj.tcanvas.getContext('2d');
        tcanvasctx.setTransform(1, 0, 0, 1, 0, 0);
        tcanvasctx.canvas.width = rw;
        tcanvasctx.canvas.height = rh;
        tcanvasctx.rotate((obj.rotation * -90) * Math.PI / 180);
        if (obj.rotation == 0) tcanvasctx.drawImage(obj.canvas.canvas, 0, 0);
        if (obj.rotation == 1) tcanvasctx.drawImage(obj.canvas.canvas, -obj.canvas.canvas.width, 0);
        if (obj.rotation == 2) tcanvasctx.drawImage(obj.canvas.canvas, -obj.canvas.canvas.width, -obj.canvas.canvas.height);
        if (obj.rotation == 3) tcanvasctx.drawImage(obj.canvas.canvas, 0, -obj.canvas.canvas.height);

        // Change the size and orientation and copy the canvas back into the rotation
        if (obj.rotation == 0 || obj.rotation == 2) { obj.canvas.canvas.height = rw; obj.canvas.canvas.width = rh; }
        if (obj.rotation == 1 || obj.rotation == 3) { obj.canvas.canvas.height = rh; obj.canvas.canvas.width = rw; }
        obj.canvas.setTransform(1, 0, 0, 1, 0, 0);
        obj.canvas.rotate((newrotation * 90) * Math.PI / 180);
        obj.rotation = newrotation;
        obj.canvas.drawImage(obj.tcanvas, _rotX(0, 0), _rotY(0, 0));

        obj.width = obj.canvas.canvas.width;
        obj.height = obj.canvas.canvas.height;
        if (obj.onScreenResize != null) obj.onScreenResize(obj, obj.width, obj.height, obj.CanvasId);
        return true;
    }
    // ###END###{DesktopRotation}

    function _fixColor(c) { return (c > 127) ? (c + 32) : c; }

    function _SendRefresh() {
        // ###BEGIN###{DesktopFocus}
        if (obj.focusmode > 0) {
            // Request only pixels around the last mouse position
            var df = obj.focusmode * 2;
            obj.send(String.fromCharCode(3, 1) + ShortToStr(Math.max(Math.min(obj.ox, obj.mx) - obj.focusmode, 0)) + ShortToStr(Math.max(Math.min(obj.oy, obj.my) - obj.focusmode, 0)) + ShortToStr(df + Math.abs(obj.ox - obj.mx)) + ShortToStr(df + Math.abs(obj.oy - obj.my))); // FramebufferUpdateRequest
            obj.ox = obj.mx;
            obj.oy = obj.my;
        } else {
        // ###END###{DesktopFocus}
            // Request the entire screen
            obj.send(String.fromCharCode(3, 1, 0, 0, 0, 0) + ShortToStr(obj.rwidth) + ShortToStr(obj.rheight)); // FramebufferUpdateRequest
        // ###BEGIN###{DesktopFocus}
        }
        // ###END###{DesktopFocus}
    }

    obj.Start = function () {
        //obj.Debug("KVM-Start");
        obj.state = 0;
        obj.acc = "";
        obj.ZRLEfirst = 1;
        //obj.inbytes = 0;
        //obj.outbytes = 0;
        // ###BEGIN###{Inflate}
        obj.inflate.inflateReset();
        // ###END###{Inflate}
        for (var i in obj.sparecache) { delete obj.sparecache[i]; }
    }

    obj.Stop = function () {
        obj.UnGrabMouseInput();
        obj.UnGrabKeyInput();
        obj.parent.Stop();
    }

    obj.send = function (x) {
        //obj.Debug("KSend(" + x.length + "): " + rstr2hex(x));
        //obj.outbytes += x.length;
        obj.parent.send(x);
    }

    /*
    Intel AMT only recognizes a small subset of keysym characters defined in the keysymdef.h so you don�t need to
    implement all the languages (this is taken care by the USB Scancode Extension in RFB4.0 protocol).
    The only subset recognized by the FW is the defined by the following sets : XK_LATIN1 , XK_MISCELLANY, XK_3270, XK_XKB_KEYS, XK_KATAKANA.
    In addition to keysymdef.h symbols there are 6 japanese extra keys that we do support:
    
    #define XK_Intel_EU_102kbd_backslash_pipe_45  0x17170056 // European 102-key: 45 (backslash/pipe),     usb Usage: 0x64
    #define XK_Intel_JP_106kbd_yen_pipe           0x1717007d // Japanese 106-key: 14 (Yen/pipe),           usb Usage: 0x89
    #define XK_Intel_JP_106kbd_backslash_underbar 0x17170073 // Japanese 106-key: 56 (backslash/underbar), usb Usage: 0x87
    #define XK_Intel_JP_106kbd_NoConvert          0x1717007b // Japanese 106-key: 131 (NoConvert),         usb Usage: 0x8b
    #define XK_Intel_JP_106kbd_Convert            0x17170079 // Japanese 106-key: 132 (Convert),           usb Usage: 0x8a
    #define XK_Intel_JP_106kbd_Hirigana_Katakana  0x17170070 // Japanese 106-key: 133 (Hirigana/Katakana), usb Usage: 0x88
    */

    function _keyevent(d, e) {
        if (!e) { e = window.event; }
        var k = e.keyCode, kk = k;
        if (e.shiftKey == false && k >= 65 && k <= 90) kk = k + 32;
        if (k >= 112 && k <= 124) kk = k + 0xFF4E;
        if (k == 8) kk = 0xff08; // Backspace
        if (k == 9) kk = 0xff09; // Tab
        if (k == 13) kk = 0xff0d; // Return
        if (k == 16) kk = 0xffe1; // Shift (Left)
        if (k == 17) kk = 0xffe3; // Ctrl (Left)
        if (k == 18) kk = 0xffe9; // Alt (Left)
        if (k == 27) kk = 0xff1b; // ESC
        if (k == 33) kk = 0xff55; // PageUp
        if (k == 34) kk = 0xff56; // PageDown
        if (k == 35) kk = 0xff57; // End
        if (k == 36) kk = 0xff50; // Home
        if (k == 37) kk = 0xff51; // Left
        if (k == 38) kk = 0xff52; // Up
        if (k == 39) kk = 0xff53; // Right
        if (k == 40) kk = 0xff54; // Down
        if (k == 45) kk = 0xff63; // Insert
        if (k == 46) kk = 0xffff; // Delete
        if (k >= 96 && k <= 105) kk = k - 48; // Key pad numbers
        if (k == 106) kk = 42; // Pad *
        if (k == 107) kk = 43; // Pad +
        if (k == 109) kk = 45; // Pad -
        if (k == 110) kk = 46; // Pad .
        if (k == 111) kk = 47; // Pad /
        if (k == 186) kk = 59; // ;
        if (k == 187) kk = 61; // =
        if (k == 188) kk = 44; // ,
        if (k == 189) kk = 45; // -
        if (k == 190) kk = 46; // .
        if (k == 191) kk = 47; // /
        if (k == 192) kk = 96; // `
        if (k == 219) kk = 91; // [
        if (k == 220) kk = 92; // \
        if (k == 221) kk = 93; // ]t
        if (k == 222) kk = 39; // '
        //console.log('Key' + d + ": " + k + " = " + kk);
        obj.sendkey(kk, d);
        return obj.haltEvent(e);
    }

    obj.sendkey = function (k, d) {
        if (typeof k == 'object') { for (var i in k) { obj.sendkey(k[i][0], k[i][1]); } }
        else { obj.send(String.fromCharCode(4, d, 0, 0) + IntToStr(k)); }
    }

    obj.SendCtrlAltDelMsg = function () { obj.sendcad(); }
    obj.sendcad = function () { obj.sendkey([[0xFFE3, 1], [0xFFE9, 1], [0xFFFF, 1], [0xFFFF, 0], [0xFFE9, 0], [0xFFE3, 0]]); } // Control down, Alt down, Delete down, Delete up , Alt up , Control up

    var _MouseInputGrab = false;
    var _KeyInputGrab = false;

    obj.GrabMouseInput = function () {
        if (_MouseInputGrab == true) return;
        var c = obj.canvas.canvas;
        c.onmouseup = obj.mouseup;
        c.onmousedown = obj.mousedown;
        c.onmousemove = obj.mousemove;
        //if (navigator.userAgent.match(/mozilla/i)) c.DOMMouseScroll = obj.xxDOMMouseScroll; else c.onmousewheel = obj.xxMouseWheel;
        _MouseInputGrab = true;
    }

    obj.UnGrabMouseInput = function () {
        if (_MouseInputGrab == false) return;
        var c = obj.canvas.canvas;
        c.onmousemove = null;
        c.onmouseup = null;
        c.onmousedown = null;
        //if (navigator.userAgent.match(/mozilla/i)) c.DOMMouseScroll = null; else c.onmousewheel = null;
        _MouseInputGrab = false;
    }

    obj.GrabKeyInput = function () {
        if (_KeyInputGrab == true) return;
        document.onkeyup = obj.handleKeyUp;
        document.onkeydown = obj.handleKeyDown;
        document.onkeypress = obj.handleKeys;
        _KeyInputGrab = true;
    }

    obj.UnGrabKeyInput = function () {
        if (_KeyInputGrab == false) return;
        document.onkeyup = null;
        document.onkeydown = null;
        document.onkeypress = null;
        _KeyInputGrab = false;
    }

    obj.handleKeys = function (e) { return obj.haltEvent(e); }
    obj.handleKeyUp = function (e) { return _keyevent(0, e); }
    obj.handleKeyDown = function (e) { return _keyevent(1, e); }
    obj.haltEvent = function (e) { if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); return false; }

    // RFB "PointerEvent" and mouse handlers
    obj.mousedown = function (e) { obj.buttonmask |= (1 << e.button); return obj.mousemove(e); }
    obj.mouseup = function (e) { obj.buttonmask &= (0xFFFF - (1 << e.button)); return obj.mousemove(e); }
    obj.mousemove = function (e) {
        if (obj.state != 4) return true;
        var pos = obj.getPositionOfControl(Q(obj.canvasid));
        obj.mx = (e.pageX - pos[0]) * (obj.canvas.canvas.height / Q(obj.canvasid).offsetHeight);
        obj.my = ((e.pageY - pos[1] + (scrolldiv ? scrolldiv.scrollTop : 0)) * (obj.canvas.canvas.width / Q(obj.canvasid).offsetWidth));

        // ###BEGIN###{DesktopRotation}
        if (obj.noMouseRotate != true) {
            obj.mx2 = _crotX(obj.mx, obj.my);
            obj.my = _crotY(obj.mx, obj.my);
            obj.mx = obj.mx2;
        }
        // ###END###{DesktopRotation}

        obj.send(String.fromCharCode(5, obj.buttonmask) + ShortToStr(obj.mx) + ShortToStr(obj.my));

        // ###BEGIN###{DesktopFocus}
        // Update focus area if we are in focus mode
        QV('DeskFocus', obj.focusmode);
        if (obj.focusmode != 0) {
            var x = Math.min(obj.mx, obj.canvas.canvas.width - obj.focusmode),
                y = Math.min(obj.my, obj.canvas.canvas.height - obj.focusmode),
                df = obj.focusmode * 2,
                c = Q(obj.canvasid),
                qx = c.offsetHeight / obj.canvas.canvas.height,
                qy = c.offsetWidth / obj.canvas.canvas.width,
                q = QS('DeskFocus'),
                ppos = obj.getPositionOfControl(Q(obj.canvasid).parentElement);
            q.left = (Math.max(((x - obj.focusmode) * qx), 0) + (pos[0] - ppos[0])) + 'px';
            q.top = (Math.max(((y - obj.focusmode) * qy), 0) + (pos[1] - ppos[1])) + 'px';
            q.width = ((df * qx) - 6) + 'px';
            q.height = ((df * qx) - 6) + 'px';
        }
        // ###END###{DesktopFocus}

        return obj.haltEvent(e);
    }

    obj.getPositionOfControl = function (Control) {
        var Position = Array(2);
        Position[0] = Position[1] = 0;
        while (Control) {
            Position[0] += Control.offsetLeft;
            Position[1] += Control.offsetTop;
            Control = Control.offsetParent;
        }
        return Position;
    }

    return obj;
}

export {
    CreateAmtRemoteDesktop
}