import React from 'react';
import { SketchPicker } from 'react-color';
import './App.css';
import { MazeGenerator } from './mazeGenComp/MazeGenerator';
import p5 from 'p5'

const App: React.FC = () => {
  //get the window dimensions
  let height = window.innerHeight - 5
  let width = window.innerWidth
  var sketch = (p: p5) => {
    new MazeGenerator(p, width, height)
  }
  new p5(sketch);
  return (
    <div className="App">
      <div className="color-picker">
        <SketchPicker />
      </div>
    </div>
  );
}

export default App;
