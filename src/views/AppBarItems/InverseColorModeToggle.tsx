import React, { FunctionComponent } from "react";
import { observer, inject } from "mobx-react";

import FormGroup from "@material-ui/core/FormGroup/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";

//https://material-ui.com/components/switches/
import { Switch } from "@material-ui/core";

import { RouterStore } from "mobx-react-router";
import { UiPreferencesStore } from "../../stores/UiPreferencesStore";

interface InverseColorModeToggleProps {
  routerStore?: RouterStore;
  uiPreferencesStore?: UiPreferencesStore;
}

const InverseColorModeToggle: FunctionComponent<InverseColorModeToggleProps> = (
  props: InverseColorModeToggleProps
) => {
  const { updateInverseColorMode, inverseColorMode } = props.uiPreferencesStore!;

  const handleChange = (name: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let status = event.target.checked;
    console.log("changing inverse color mode to");
    console.log(status);
    updateInverseColorMode(status);
  };

  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Switch
            checked={inverseColorMode}
            onChange={handleChange("checkedB")}
            value="checkedB"
            color="primary"
          />
        }
        label="Inverse Colors"
      />
    </FormGroup>
  );
};

export default inject(
  "uiPreferencesStore",
  "routerStore"
)(observer(InverseColorModeToggle));
