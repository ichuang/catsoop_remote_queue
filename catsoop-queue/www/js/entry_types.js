const entry_types = {
    'help': {
        button_sort: ['claim', 'disclaim', 'remove'],
        buttons: {
            'claim': {text: 'claim', shortcuts: []},
            'disclaim': {text: 'disclaim', shortcuts: ['d']},
            'remove': {text: 'remove', shortcuts: ['r']},
        },
    },
    'checkoff': {
        button_sort: ['claim', 'disclaim', 'remove', 'group_checkoff', 'single_checkoff'],
        buttons: {
            'claim': {text: 'claim', shortcuts: []},
            'disclaim': {text: 'disclaim', shortcuts: ['d']},
            'remove': {text: 'remove', shortcuts: ['r']},
            'group_checkoff': {text: 'group checkoff', shortcuts: ['g']},
            'single_checkoff': {text: 'single checkoff', shortcuts: ['s']},
        },
    },
};

module.exports = entry_types;
