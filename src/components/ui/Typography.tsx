import React from 'react';
import { Text, TextStyle } from 'react-native';
import { AuroraTheme } from '../../design/theme';

interface TypographyProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption' | 'overline';
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'success' | 'warning' | 'error';
  weight?: 'normal' | 'medium' | 'semiBold' | 'bold';
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: TextStyle;
}

const Typography: React.FC<TypographyProps> = ({
  children,
  variant = 'body1',
  color = 'primary',
  weight = 'normal',
  align = 'left',
  numberOfLines,
  style,
}) => {
  const getTextStyle = (): TextStyle => {
    const variantStyles = {
      h1: {
        fontSize: AuroraTheme.typography.sizes['5xl'],
        lineHeight: AuroraTheme.typography.sizes['5xl'] * AuroraTheme.typography.lineHeights.tight,
        fontWeight: AuroraTheme.typography.weights.bold,
      },
      h2: {
        fontSize: AuroraTheme.typography.sizes['4xl'],
        lineHeight: AuroraTheme.typography.sizes['4xl'] * AuroraTheme.typography.lineHeights.tight,
        fontWeight: AuroraTheme.typography.weights.bold,
      },
      h3: {
        fontSize: AuroraTheme.typography.sizes['3xl'],
        lineHeight: AuroraTheme.typography.sizes['3xl'] * AuroraTheme.typography.lineHeights.tight,
        fontWeight: AuroraTheme.typography.weights.semiBold,
      },
      h4: {
        fontSize: AuroraTheme.typography.sizes['2xl'],
        lineHeight: AuroraTheme.typography.sizes['2xl'] * AuroraTheme.typography.lineHeights.normal,
        fontWeight: AuroraTheme.typography.weights.semiBold,
      },
      h5: {
        fontSize: AuroraTheme.typography.sizes.xl,
        lineHeight: AuroraTheme.typography.sizes.xl * AuroraTheme.typography.lineHeights.normal,
        fontWeight: AuroraTheme.typography.weights.medium,
      },
      h6: {
        fontSize: AuroraTheme.typography.sizes.lg,
        lineHeight: AuroraTheme.typography.sizes.lg * AuroraTheme.typography.lineHeights.normal,
        fontWeight: AuroraTheme.typography.weights.medium,
      },
      body1: {
        fontSize: AuroraTheme.typography.sizes.base,
        lineHeight: AuroraTheme.typography.sizes.base * AuroraTheme.typography.lineHeights.normal,
        fontWeight: AuroraTheme.typography.weights.normal,
      },
      body2: {
        fontSize: AuroraTheme.typography.sizes.sm,
        lineHeight: AuroraTheme.typography.sizes.sm * AuroraTheme.typography.lineHeights.normal,
        fontWeight: AuroraTheme.typography.weights.normal,
      },
      caption: {
        fontSize: AuroraTheme.typography.sizes.xs,
        lineHeight: AuroraTheme.typography.sizes.xs * AuroraTheme.typography.lineHeights.normal,
        fontWeight: AuroraTheme.typography.weights.normal,
      },
      overline: {
        fontSize: AuroraTheme.typography.sizes.xs,
        lineHeight: AuroraTheme.typography.sizes.xs * AuroraTheme.typography.lineHeights.normal,
        fontWeight: AuroraTheme.typography.weights.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      },
    } as const;

    const colorStyles = {
      primary: { color: AuroraTheme.colors.text.primary },
      secondary: { color: AuroraTheme.colors.text.secondary },
      tertiary: { color: AuroraTheme.colors.text.tertiary },
      inverse: { color: AuroraTheme.colors.text.inverse },
      success: { color: AuroraTheme.colors.success },
      warning: { color: AuroraTheme.colors.warning },
      error: { color: AuroraTheme.colors.error },
    };

    const weightStyles = {
      normal: { fontWeight: AuroraTheme.typography.weights.normal },
      medium: { fontWeight: AuroraTheme.typography.weights.medium },
      semiBold: { fontWeight: AuroraTheme.typography.weights.semiBold },
      bold: { fontWeight: AuroraTheme.typography.weights.bold },
    };

    return {
      ...variantStyles[variant],
      ...colorStyles[color],
      ...weightStyles[weight],
      textAlign: align,
    };
  };

  return (
    <Text style={[getTextStyle(), style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
};

export default Typography;