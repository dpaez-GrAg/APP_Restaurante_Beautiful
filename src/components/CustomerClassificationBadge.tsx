import { CustomerClassification, CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from "@/types/customer";

interface CustomerClassificationBadgeProps {
  classification: CustomerClassification;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const CustomerClassificationBadge = ({
  classification,
  size = "md",
  showLabel = true,
  className = "",
}: CustomerClassificationBadgeProps) => {
  const color = CLASSIFICATION_COLORS[classification];
  const label = CLASSIFICATION_LABELS[classification];

  const sizeClasses = {
    sm: "w-3 h-3 text-xs",
    md: "w-4 h-4 text-sm",
    lg: "w-5 h-5 text-base",
  };

  const paddingClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const dotSizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  if (!showLabel) {
    // Solo mostrar círculo de color
    return (
      <div
        className={`${sizeClasses[size]} rounded-full border-2 border-white shadow-sm ${className}`}
        style={{ backgroundColor: color }}
        title={label}
      />
    );
  }

  // Determinar color de texto basado en el fondo
  const getTextColor = (bgColor: string) => {
    // Para colores claros como dorado, usar texto oscuro
    if (bgColor === "#FFD700") return "#1F2937"; // Gris oscuro para VIP
    return "#FFFFFF"; // Blanco para el resto
  };

  const textColor = getTextColor(color);

  return (
    <span
      className={`inline-flex items-center gap-2 ${paddingClasses[size]} rounded-full font-medium shadow-sm border ${className}`}
      style={{
        backgroundColor: color,
        color: textColor,
        borderColor: color,
      }}
    >
      <div className={`${dotSizeClasses[size]} rounded-full`} style={{ backgroundColor: textColor, opacity: 0.3 }} />
      <span className="font-semibold">{label}</span>
    </span>
  );
};

export default CustomerClassificationBadge;
