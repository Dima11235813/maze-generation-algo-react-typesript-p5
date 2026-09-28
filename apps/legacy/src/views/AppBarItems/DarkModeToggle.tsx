import React from 'react'

export const DarkModeToggle = () => {
    const [state, setState] = React.useState({
        checkedA: true,
        checkedB: true,
      });
    
      const handleChange = (name: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setState({ ...state, [name]: event.target.checked });
      };
    
    return (
        <div></div>
    )
}