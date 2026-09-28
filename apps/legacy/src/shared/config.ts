export const ENV = process.env.NODE_ENV;
export const STATE = process.env.REACT_APP_STATE;

export const DATA_API_URL: string = process.env.REACT_APP_API_ENDPOINT || '';
export const APP_API_URL: string = process.env.REACT_APP_ADMIN_API_ENDPOINT || '';

export const USE_AUTH: boolean = (process.env.REACT_APP_USE_AUTH || 'true').trim().toLowerCase() === 'true';
export const USE_LOGGER: boolean = (process.env.REACT_APP_USE_LOGGER || '').trim().toLowerCase() === 'true';