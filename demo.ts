// SimpleScript demo
function greet(name: string, times: number) {
  for (const i of [1, 2, 3]) {
    console.log('Hello, ' + name)
  }
}

function sayDone() {
  console.log('done')
}

let x: string = prompt('Your name?')
greet(x, 3)
sayDone()

console.log('renamed log works')

