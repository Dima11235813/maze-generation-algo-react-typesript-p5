import React from 'react';
import { SketchPicker, ColorPickerProps, RGBColor } from 'react-color';
import './App.css';
import { MazeGenerator } from './mazeGenComp/MazeGenerator';
import p5 from 'p5'
import { Color } from './utils/colorUtils';

const App: React.FC = () => {
  // const handleColorChangeComplete = (color: any) => {
  //   debugger
  // }
  //SET DEFAULT COLORS FOR MAZE
  const defaultCellColor = new Color(255, 255, 100)
  const defaultBackgroundColor = new Color(0, 0, 0, 0)

  //SET UP CHANGABLE VAR FOR COLOR TO PASS TO GENERATOR
  let cellColor = defaultCellColor
  let backgroundColor = defaultBackgroundColor

  //SET UP HANDLERS FOR COLOR CHANGE
  const handleColorChange = (color: any) => {
    const { r, g, b, a } = color.rgb
    cellColor.r = r
    cellColor.g = g
    cellColor.b = b
    if (a) {
      cellColor.a = a
    } else {
      backgroundColor.a = 1
    }
  }
  const handleBackgroundColorChange = (color: any) => {
    const { r, g, b, a } = color.rgb
    backgroundColor.r = r
    backgroundColor.g = g
    backgroundColor.b = b
    if (a) {
      backgroundColor.a = a
    } else {
      backgroundColor.a = 1
    }
  }

  //get the window dimensions
  let height = window.innerHeight - 5
  let width = window.innerWidth
  var sketch = (p: p5) => {
    new MazeGenerator(
      p,
      width,
      height,
      cellColor,
      backgroundColor)
  }
  new p5(sketch);
  return (
    <div className="App">
      <div className="color-picker">
        <div>Cell Color</div>
        <SketchPicker
          color={defaultCellColor}
          onChange={handleColorChange}
        // onChangeComplete={handleColorChangeComplete}
        />
      </div>
      <div className="color-picker-2">
        <div>Background Color</div>
        <SketchPicker
          color={defaultBackgroundColor}
          onChange={handleBackgroundColorChange}
        // onChangeComplete={handleColorChangeComplete}
        />
      </div>
    </div>
  );
}

export default App;
