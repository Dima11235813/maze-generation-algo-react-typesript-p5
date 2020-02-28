// Warning: Experimental library, do not use in production environments.
import StackdriverErrorReporter from 'stackdriver-errors-js';

export const errorHandler = new StackdriverErrorReporter();
errorHandler.start({
    // key: "AIzaSyCeRpnuW1Jb4bRTuz7IOuHoSqTI1issr0I",
    // projectId: "devenv-259801",
    key: "AIzaSyBUk2SwrHzyW9d7blXrCv9TfuGTyaUWWt8",
    projectId: "linen-rex-259801",

    // The following optional arguments can also be provided:

    // service: myServiceName,
    // Name of the service reporting the error, defaults to 'web'.

    // version: myServiceVersion,
    // Version identifier of the service reporting the error.

    // reportUncaughtExceptions: false
    // Set to false to prevent reporting unhandled exceptions.

    // reportUnhandledPromiseRejections: false
    // Set to false to prevent reporting unhandled promise rejections.

    // disabled: true
    // Set to true to not send error reports, this can be used when developing locally.

    // context: {user: 'user1'}
    // You can set the user later using setUser()
});