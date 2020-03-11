import React, { FunctionComponent } from "react";
import { observer, inject } from "mobx-react";

import FormGroup from "@material-ui/core/FormGroup/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";

//https://material-ui.com/components/switches/
import { Switch } from "@material-ui/core";

import { RouterStore } from "mobx-react-router";
import { MazeViewStore } from "../../stores/MazeViewStore";
import { logger } from "../../utils/loggingUtils";

interface MazeGenCubeProjectionShowToggleProps {
  routerStore?: RouterStore;
  mazeViewStore?: MazeViewStore;
}

const MazeGenCubeProjectionShowToggle: FunctionComponent<MazeGenCubeProjectionShowToggleProps> = (
  props: MazeGenCubeProjectionShowToggleProps
) => {
  const { changeShowGeneratorCubeProjection, showGeneratorCubeProjection } = props.mazeViewStore!;

  const handleChange = (name: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let status = event.target.checked;
    logger(`changing inverse color mode to ${status}`);
    changeShowGeneratorCubeProjection();
  };

  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Switch
            checked={showGeneratorCubeProjection}
            onChange={handleChange("checked")}
            value="checked"
            color="primary"
          />
        }
        label="Show 3D Cube Projection"
      />
    </FormGroup>
  );
};

export default inject(
  "mazeViewStore",
  "routerStore"
)(observer(MazeGenCubeProjectionShowToggle));
