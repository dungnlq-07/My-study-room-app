// src/components/FilterButton.tsx
// Nút lọc [Filter ▼] nằm ngang hàng với thanh tìm kiếm (bên phải).

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../presentation/theme/useAppTheme';

interface FilterButtonProps {
  /** Callback khi người dùng bấm nút lọc */
  onPress?: () => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({ onPress }) => {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Filter rooms"
    >
      <Ionicons name="options-outline" size={19} color={colors.secondaryText} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF2',
    borderRadius: 10,
    width: 40,
    height: 40,
    marginLeft: 10,
  },
});

export default FilterButton;