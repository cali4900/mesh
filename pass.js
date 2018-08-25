// check out https://github.com/tj/node-pwd

// Module dependencies.
const crypto = require('crypto');

// Bytesize.
const len = 128;

// Iterations. ~300ms
const iterations = 12000;

/**
 * Hashes a password with optional `salt`, otherwise
 * generate a salt for `pass` and invoke `fn(err, salt, hash)`.
 *
 * @param {String} password to hash
 * @param {String} optional salt
 * @param {Function} callback
 * @api public
 */
exports.hash = function (pwd, salt, fn) {
    if (3 == arguments.length) {
        try {
            crypto.pbkdf2(pwd, salt, iterations, len, 'sha384', function (err, hash) { fn(err, hash.toString('base64')); });
        } catch (e) {
            // If this previous call fails, it's probably because older pbkdf2 did not specify the hashing function, just use the default.
            crypto.pbkdf2(pwd, salt, iterations, len, function (err, hash) { fn(err, hash.toString('base64')); });
        }
    } else {
        fn = salt;
        crypto.randomBytes(len, function (err, salt) {
            if (err) return fn(err);
            salt = salt.toString('base64');
            try {
                crypto.pbkdf2(pwd, salt, iterations, len, 'sha384', function (err, hash) { if (err) { return fn(err); } fn(null, salt, hash.toString('base64')); });
            } catch (e) {
                // If this previous call fails, it's probably because older pbkdf2 did not specify the hashing function, just use the default.
                crypto.pbkdf2(pwd, salt, iterations, len, function (err, hash) { if (err) { return fn(err); } fn(null, salt, hash.toString('base64')); });
            }
        });
    }
};

exports.iishash = function (type, pwd, salt, fn) {
    if (type == 0) {
        fn(null, pwd);
    } else if (type == 1) {
        const hash = crypto.createHash('sha1');
        hash.update(Buffer.concat([new Buffer(salt, 'base64'), new Buffer(pwd, 'utf16le')]));
        fn(null, hash.digest().toString('base64'));
    } else {
        fn('invalid type');
    }
};
