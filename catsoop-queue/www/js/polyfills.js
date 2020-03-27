require('core-js/es6/promise');
require('core-js/es6/symbol');
require('core-js/fn/array/includes');
require('core-js/fn/array/find');
require('core-js/fn/array/from');
require('core-js/fn/object/assign');
require('core-js/fn/set');

Set.prototype.union = function(other) {
    for (let elt of other) {
        this.add(elt);
    }
    return this;
}

Set.prototype.difference = function(other) {
    for (var elt of other) {
        this.delete(elt);
    }
    return this;
}
