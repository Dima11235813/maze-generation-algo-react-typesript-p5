import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Slider from "@material-ui/core/Slider";
import Input from "@material-ui/core/Input";
import FormatSize from "@material-ui/icons/FormatSize";

//Maze Config
import { MazeOptionsSetter } from "../mazeGenComp/mazeUtils/mazeOptionsSetter";
import { CELL_MIN_SIZE, MIN_NUMBER_OF_CELLS_HORIZONTALLY, CELL_SIZE_INCREMENT_INTERVAL } from "../shared/constants";

interface FrameRateSlider {
  mazeOptionsSetter: MazeOptionsSetter;
  onFrameChange: Function;
  frameRate: number

}

const FrameRateSlider = (props: FrameRateSlider) => {
  const { mazeOptionsSetter, frameRate ,onFrameChange} = props!;
  //frame rate rules
  let minFrameRate = 1
  let maxFrameRate = 100//?
  let frameRateIncrementor = 1
  

  //create ui component
  const useStyles = makeStyles({
    root: {
      width: 200
    },
    input: {
      width: 42
    }
  });
  const classes = useStyles();

  //Set up state for slider
  const [value, setValue] = React.useState(frameRate);

  //Event for slider
  const handleSliderChange = (event: any, newValue: any) => {
    setStateAndPersistSelection(newValue);
  };
  //Even for input
  const handleInputChange = (event: any) => {
    let newValue =
      event.target.value === "" ? CELL_MIN_SIZE : Number(event.target.value);
    setStateAndPersistSelection(newValue);
  };
  const setStateAndPersistSelection = (newValue: number) => {
    let valueForStorage = setStateConditionally(newValue);
    updateCellSizeForMaze(valueForStorage);
  };
  const updateCellSizeForMaze = (newValue: number) => {
    mazeOptionsSetter.handleFrameRateChange(newValue);
    onFrameChange();
  };

  //state change

  const handleBlur = () => {
    setStateConditionally(value);
  };
  const setStateConditionally = (value: number): number => {
    if (value < minFrameRate) {
      setValue(minFrameRate);
      return minFrameRate;
    } else if (value > maxFrameRate) {
      setValue(maxFrameRate);
      return maxFrameRate;
    } else {
      setValue(value);
      return value;
    }
  };

  return (
    <div className={classes.root}>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <FormatSize />
        </Grid>
        <Grid item xs>
          <Slider
            value={typeof value === "number" ? value : CELL_MIN_SIZE}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
          />
        </Grid>
        <Grid item>
          <Input
            className={classes.input}
            value={value}
            margin="dense"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: frameRateIncrementor,
              min: CELL_MIN_SIZE,
              max: maxFrameRate,
              type: "number",
              "aria-labelledby": "input-slider"
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
};
export default FrameRateSlider;
