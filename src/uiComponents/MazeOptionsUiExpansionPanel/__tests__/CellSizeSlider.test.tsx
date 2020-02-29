import React from 'react';
import CellSizeSlider, { CellSizeSliderProps } from '../../CellSizeSlider';
import { MazeOptions } from '../../../mazeGenComp/mazeUtils/mazeOptions';
import { MazeOptionsSetter } from '../../../mazeGenComp/mazeUtils/mazeOptionsSetter';
import { shallow } from 'enzyme';

let mazeOptions = new MazeOptions()

const cellSizeSliderProps: CellSizeSliderProps = {
    mazeOptionsSetter: new MazeOptionsSetter(mazeOptions),
    onSizeChange: () => undefined,
    cellSize: 5,
    windowWidth: 500,

}

it('renders without crashing', () => {
    let wrapper = shallow(<CellSizeSlider {...cellSizeSliderProps} />);
    expect(wrapper).toMatchSnapshot()
});
