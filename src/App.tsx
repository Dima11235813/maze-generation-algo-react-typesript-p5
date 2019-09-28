import React from 'react';
import './App.css';
import { MazeGenerator } from './mazeGenComp/MazeGenerator';
import p5 from 'p5'

const App: React.FC = () => {
  var sketch = (p: p5) => {
    new MazeGenerator(p)
  }
  new p5(sketch);

  return (
    <div className="App">

    </div>
  );
}

export default App;
