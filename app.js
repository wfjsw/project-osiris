#!/usr/bin/env Node

const Telegram = require('node-telegram-bot-api');
const fs = require('fs');
const b64url = require('base64-url')
const config = require('./config.json');

var bot = new Telegram(config['api-key'], config['options']);

const message_type = [
    'audio',
    'channel_chat_created',
    'contact',
    'delete_chat_photo',
    'document',
    'game',
    'group_chat_created',
    'invoice',
    'left_chat_member',
    'location',
    'migrate_from_chat_id',
    'migrate_to_chat_id',
    'new_chat_members',
    'new_chat_photo',
    'new_chat_title',
    'photo',
    'pinned_message',
    'sticker',
    'successful_payment',
    'supergroup_chat_created',
    'text',
    'video',
    'video_note',
    'voice',
]
const other_type = ['edited_message', 'channel_post', 'inline_query', 'chosen_inline_result', 'callback_query', 'shipping_query', 'pre_checkout_query']
var global_e = {
    bot: bot,
    me: {},
    libs: {},
    plugins: {},
    preprocessors: [],
    runners: [],

    msgtype_listeners: {},
    edited_listeners: [],
    regex_listeners: []
};

function getAllLibrarySync() {
    return fs.readdirSync('lib');
}

function getAllPluginsSync() {
    return fs.readdirSync('plugins');
}

function getJsFilename(original) {
    var match = /^(.*)\.js$/.exec(original);
    if (match)
        return match[1];
    else
        return false;
}

function loadLib(id) {
    if (global_e.libs[id]) delete global_e.libs[id];
    global_e.libs[id] = require(`./lib/${id}.js`);
}

function loadAllLib() {
    global_e.libs = [];
    var libfiles = getAllLibrarySync();
    libfiles.forEach((targetlib) => {
        var libname = getJsFilename(targetlib);
        if (!libname) return;
        if (libname.slice(0, 9).toLowerCase() == 'disabled_') return;

        console.log(`Loading library ${targetlib} ...`);
        global_e.libs[libname] = require(`./lib/${targetlib}`);
        if (global_e.libs[libname].init)
            global_e.libs[libname].init(global_e);
    })
}

function loadAllPlugin() {
    global_e.plugins = [];
    var plgfiles = getAllPluginsSync();
    plgfiles.forEach((targetplg) => {
        var plgname = getJsFilename(targetplg);

        if (!plgname) return;
        if (plgname.slice(0, 9).toLowerCase() == 'disabled_') return;

        console.log(`Loading plugin ${targetplg} ...`);
        global_e.plugins[plgname] = require(`./plugins/${targetplg}`);
        if (global_e.plugins[plgname].init) global_e.plugins[plgname].init(global_e);
        if (global_e.plugins[plgname].preprocess)
            global_e.preprocessors.push(global_e.plugins[plgname].preprocess);
        if (global_e.plugins[plgname].run)
            global_e.plugins[plgname].run.forEach((runobj) => {
                global_e.runners.push(runobj);
            })
    })
}

function diverseListeners() {
    message_type.forEach((type) => {
        global_e.msgtype_listeners[type] = []; // init array
    });
    other_type.forEach((type) => {
        global_e.msgtype_listeners[type] = []; // init array
    });
    global_e.edited_listeners = []; // init array
    global_e.runners.forEach(([test, callback]) => {
        // Diverse MediaType Listeners
        if ((test.constructor == String) && ((message_type.indexOf(test) > -1) || (other_type).indexOf(test) > -1))
            global_e.msgtype_listeners[test].push(callback);
        else if (test == 'edited_message')
            global_e.edited_listeners.push(callback);
        // Diverse RegExpression Listeners
        else if (test instanceof RegExp)
            global_e.regex_listeners.push([test, callback]);
    });
}

loadAllLib();
loadAllPlugin();
diverseListeners();

function trimCmd(command) {
    try {
        if (command.slice(0, 1) == '/') {
            var t1 = command.split(' ');
            var t2 = t1[0].split('@')
            if (t2.length > 1) {
                var t3 = t2.pop();
                if (t3 == global_e.me.username) {
                    t1.shift();
                    return t2.concat(t1).join(' ');
                } else {
                    return command;
                }
            } else {
                return command;
            }
        } else {
            return command;
        }
    } catch (e) {
        console.error(e);
    }
}

function decStart(command) {
    let match = command.match(/^\/start DEC-(.+)/)
    if (match) {
        return `/start ${b64url.decode(match[0])}`
    } else {
        return command
    }
}

bot.on('message', (msg) => {
    // Preprocessor hook all messages
    try {
        global_e.preprocessors.forEach((preprocessor) => {
            preprocessor(msg, bot);
        });

        // Process MediaTypes
        message_type.forEach((type) => {
            if (msg[type])
                global_e.msgtype_listeners[type].forEach((cb) => {
                    cb(msg, type, bot);
                });
        });

        // Process RegExp
        global_e.regex_listeners.forEach(([test, callback]) => {
            var matches;
            if (msg.text) matches = test.exec(decStart(trimCmd(msg.text)))
            else if (msg.caption) matches = test.exec(msg.caption);
            if (matches)
                callback(msg, matches, bot);
        });
    } catch (e) {
        console.error(e);
    }
});

bot.on('edited_message', (msg) => {
    try {
        global_e.edited_listeners.forEach((cb) => {
            cb(msg, 'edited_message', bot);
        });
    } catch (e) {
        console.error(e);
    }
});

other_type.forEach((type) => {
    bot.on(type, (msg) => {
        global_e.msgtype_listeners[type].forEach((cb) => {
            cb(msg, type, bot);
        });
    })
});

bot.getMe().then((ret) => {
    global_e.me = ret;
    console.log(ret);
})
