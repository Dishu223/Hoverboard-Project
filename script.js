const container = document.getElementById('container')
const colors = ['#7400B8', '#6930C3', '#5E60CE', '#5390D9', '#4EA8DE', '#48BFE3', '#56CFE1', '#64DFDF', '#72EFDD', '#80FFDB', '#FFE5EC', '#FFC2D1', '#FFB3C6', '#FF8FAB', '#FB6F92']
const SQUARES = 500

for(let i=0; i<SQUARES; i++)
{
    const square = document.createElement('div')
    square.classList.add('square')

    square.addEventListener('mouseover', () => setColor(square))
    square.addEventListener('mouseout', () => removeColor(square))

    container.appendChild(square)
}

function setColor(element){
  const color = getRandomColor()
  element.style.background = color
  element.style.boxShadow = `0 0 2px ${color}, 0 0 10px ${color}`
}

function removeColor(element){
  element.style.background = '#1d1d1d'
  element.style.boxShadow = '0 0 2px #000'

}

function getRandomColor(){
  return colors[Math.floor(Math.random() * colors.length)]
}