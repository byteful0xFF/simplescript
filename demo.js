// SimpleScript demo
function greet(name, times) {
    for (var _i = 0, _a = [1, 2, 3]; _i < _a.length; _i++) {
        var i = _a[_i];
        console.log('Hello, ' + name);
    }
}
function sayDone() {
    console.log('done');
}
var x = prompt('Your name?');
greet(x, 3);
sayDone();
console.log('renamed log works');
