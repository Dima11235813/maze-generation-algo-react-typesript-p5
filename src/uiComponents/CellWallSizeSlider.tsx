import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Slider from "@material-ui/core/Slider";
import Input from "@material-ui/core/Input";
import FormatSize from "@material-ui/icons/FormatSize";

//Maze Config
import { MazeOptions } from "../mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "../mazeGenComp/mazeUtils/mazeOptionsSetter";
import { Labels } from "../shared/labels";

interface CellSizeSlider {
  mazeOptions: MazeOptions;
  mazeOptionsSetter: MazeOptionsSetter;
  onSizeChange: Function
}

const CellSizeSlider = (props: CellSizeSlider) => {
  const { mazeOptionsSetter, mazeOptions, onSizeChange } = props;
  //cell width rules
  let minCellWidth = 6;
  let maxCellWidth = mazeOptions.width / 20;
  let cellSizeIncrementor = 2

  const useStyles = makeStyles({
    root: {
      width: 200
    },
    input: {
      width: 42
    }
  });
  const classes = useStyles();
  const [value, setValue] = React.useState(mazeOptions.cellSize);

//   const handleSliderChange = (event: React.ChangeEvent<Element>, newValue: number | number[]) => {
  const handleSliderChange = (event: any, newValue: any) => {
    setValue(newValue);
    mazeOptionsSetter.handleCellWidthChange(newValue);
    onSizeChange()
  };

  const handleInputChange = (event: any) => {
    setValue(
      event.target.value === "" ? minCellWidth : Number(event.target.value)
    );
  };

  const handleBlur = () => {
    if (value < minCellWidth) {
      setValue(minCellWidth);
    } else if (value > maxCellWidth) {
      setValue(maxCellWidth);
    }
  };

  //PUT into UI controls generator class

  let interval = 5;
  let numberOfOptions = Math.floor((maxCellWidth - minCellWidth) / interval);
  let optionsValue = minCellWidth;
  //   let dropDownForCellWidth = (
  //     <select onChange={handleCellWidthChangeInApp}>
  //       {new Array(numberOfOptions).fill(1).map(item => {
  //         let valueToUse = optionsValue;
  //         optionsValue += interval;
  //         return (
  //           <option
  //             key={valueToUse}
  //             value={valueToUse}
  //             selected={valueToUse === mazeOptions.cellSize}
  //           >
  //             {valueToUse}
  //           </option>
  //         );
  //       })}
  //     </select>
  //   );

  return (
    <div className={classes.root}>
      <Typography id="input-slider" gutterBottom>
        {Labels.CELL_WIDTH_LABEL}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <FormatSize />
        </Grid>
        <Grid item xs>
          <Slider
            value={typeof value === "number" ? value : minCellWidth}
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
              step: cellSizeIncrementor,
              min: minCellWidth,
              max: maxCellWidth,
              type: "number",
              "aria-labelledby": "input-slider"
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
};
export default CellSizeSlider;
