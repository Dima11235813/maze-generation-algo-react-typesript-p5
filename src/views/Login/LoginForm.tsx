import React, { useState } from "react";
import TextField from "@material-ui/core/TextField";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import { UserDtoDefault } from "../../api/models/UserDTO";
import { ButtonGroup, Button, ButtonProps, Container } from "@material-ui/core";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      "& .MuiTextField-root": {
        margin: theme.spacing(1),
        width: 200
      }
    }
  })
);
interface LoginFormProps {
  onSubmit: (data: any) => Promise<void>;
}
// https://material-ui.com/components/text-fields/
const LoginForm: React.SFC<LoginFormProps> = (props: LoginFormProps) => {
  const defaultUserFormData = new UserDtoDefault();
  const [name, setName] = useState(defaultUserFormData.name);
  const [email, setEmail] = useState(defaultUserFormData.email);
  const [password, setPassword] = useState(defaultUserFormData.password);
  const { onSubmit } = props;
  const classes = useStyles();
  return (
    <Container fixed>
      <form className={classes.root} noValidate autoComplete="off">
        <div>
          <TextField
            id="outlined"
            label="Name"
            defaultValue={name}
            variant="outlined"
            onChange={() => {
              return { onChange: setName };
            }}
          />
          <TextField
            required
            id="outlined-required"
            label="Email"
            defaultValue={email}
            variant="outlined"
            onChange={() => {
              return { onChange: setEmail };
            }}
          />
          <TextField
            required
            //   id="outlined-required"
            id="outlined-password-input"
            //   label="Required"
            defaultValue={password}
            variant="outlined"
            autoComplete="current-password"
            label="Password"
            type="password"
            onChange={() => {
              return { onChange: password };
            }}
          />
        </div>
        <div>
          <ButtonGroup
            {...buttonGroupProps}
            color="primary"
            aria-label="outlined primary button group"
          >
            <Button {...buttonProps}>Create Account</Button>
            <Button {...buttonProps}>Forgot Password</Button>
            <Button {...buttonProps} onSubmit={onSubmit}>
              Login
            </Button>
          </ButtonGroup>
        </div>
      </form>
    </Container>
  );
};
const buttonGroupProps: any = {
  orientation: "vertical"
};
const buttonProps: ButtonProps = {
  fullWidth: true,
  color: "primary"
};

export default LoginForm;
