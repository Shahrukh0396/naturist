declare module 'react-native-image-slider-box' {
  import { Component } from 'react';
  import { ViewStyle, ImageStyle } from 'react-native';

  export interface ImageSliderBoxProps {
    images: string[];
    sliderBoxHeight?: number;
    onCurrentImagePressed?: (index: number) => void;
    currentImageEmitter?: (index: number) => void;
    dotColor?: string;
    inactiveDotColor?: string;
    paginationBoxVerticalPadding?: number;
    autoplay?: boolean;
    circleLoop?: boolean;
    ImageComponent?: any;
    resizeMethod?: 'resize' | 'scale' | 'auto';
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    ImageComponentStyle?: ViewStyle | ImageStyle;
    imageLoadingColor?: string;
    parentWidth?: number;
    disableOnPress?: boolean;
    thumbnail?: boolean;
    thumbnailHeight?: number;
    thumbnailWidth?: number;
    thumbnailResizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    onImageChanged?: (index: number) => void;
  }

  export default class ImageSliderBox extends Component<ImageSliderBoxProps> {}
}

