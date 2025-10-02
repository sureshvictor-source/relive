import React from 'react';
import { View, ViewStyle, TouchableOpacity } from 'react-native';
import { AuroraTheme } from '../../design/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'flat' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  margin?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: ViewStyle;
  backgroundColor?: string;
  borderRadius?: number;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'md',
  margin = 'none',
  onPress,
  style,
  backgroundColor = AuroraTheme.colors.surface,
  borderRadius = AuroraTheme.radius.lg,
}) => {
  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor,
      borderRadius,
    };

    // Padding variations
    const paddingStyles = {
      none: { padding: 0 },
      sm: { padding: AuroraTheme.spacing.sm },
      md: { padding: AuroraTheme.spacing.md },
      lg: { padding: AuroraTheme.spacing.lg },
    };

    // Margin variations
    const marginStyles = {
      none: { margin: 0 },
      sm: { margin: AuroraTheme.spacing.sm },
      md: { margin: AuroraTheme.spacing.md },
      lg: { margin: AuroraTheme.spacing.lg },
    };

    // Variant styles
    const variantStyles = {
      elevated: {
        ...AuroraTheme.shadows.md,
      },
      flat: {
        shadowOpacity: 0,
        elevation: 0,
      },
      outlined: {
        shadowOpacity: 0,
        elevation: 0,
        borderWidth: 1,
        borderColor: AuroraTheme.colors.border,
      },
    };

    return {
      ...baseStyle,
      ...paddingStyles[padding],
      ...marginStyles[margin],
      ...variantStyles[variant],
    };
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[getCardStyle(), style]}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[getCardStyle(), style]}>{children}</View>;
};

export default Card;