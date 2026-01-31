import { cn } from "@/lib/utils";

interface GroupIconSelectorProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
}

const iconOptions = [
  "🏠",
  "👨‍👩‍👧‍👦",
  "❤️",
  "🎉",
  "🌈",
  "🌟",
  "🎨",
  "🎵",
  "⚽",
  "🍕",
  "☕",
  "🌸",
  "🚀",
  "💼",
  "📚",
  "🎮",
  "🏃",
  "🧘",
  "⛰️",
  "🏖️",
  "🎭",
  "🎪",
  "🎬",
  "🎸",
];

export function GroupIconSelector({ selectedIcon, onSelect }: GroupIconSelectorProps) {
  return (
    <div className="grid grid-cols-6 gap-2 mt-2 p-3 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
      {iconOptions.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onSelect(icon)}
          className={cn(
            "w-12 h-12 flex items-center justify-center text-2xl rounded-lg transition-all hover:scale-110",
            selectedIcon === icon
              ? "bg-orange-500 ring-2 ring-orange-500 ring-offset-2"
              : "bg-white hover:bg-gray-100",
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
