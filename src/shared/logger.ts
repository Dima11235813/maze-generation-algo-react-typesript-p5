import { USE_LOGGER } from './config';

//temp logger
export const logToConsole = (message: string) => {
  if (USE_LOGGER) {
    console.log(message)
  }
};

export const logObjToConsole = (obj: any) => {
  if (USE_LOGGER) {
    console.log(obj)
  }
};

export const logEnvVariables = () => {
  logToConsole(`
    ENVIORENTMENT VARIABLES:
    NODE_ENV:                             [${ process.env.NODE_ENV}]
    REACT_APP_ENV :                       [${process.env.REACT_APP_ENV}]
    REACT_APP_SHOULD_LOG :                [${process.env.REACT_APP_SHOULD_LOG}]
    REACT_APP_USE_LOGGER :                [${process.env.REACT_APP_USE_LOGGER}]
    REACT_APP_API_ENDPOINT :              [${process.env.REACT_APP_API_ENDPOINT}]
    REACT_APP_ADMIN_API_ENDPOINT :        [${process.env.REACT_APP_ADMIN_API_ENDPOINT}]
    REACT_APP_USE_AUTH :                  [${process.env.REACT_APP_USE_AUTH}]


  `);
};