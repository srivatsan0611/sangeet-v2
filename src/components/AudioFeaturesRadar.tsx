"use client";

import { useMemo } from "react";

interface AudioFeatures {
  valence: number;
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
}

interface AudioFeaturesRadarProps {
  features: AudioFeatures;
  size?: number;
}

export function AudioFeaturesRadar({ features, size = 300 }: AudioFeaturesRadarProps) {
  const metrics = [
    { key: "valence", label: "Valence", color: "#a855f7" },
    { key: "energy", label: "Energy", color: "#f97316" },
    { key: "danceability", label: "Dance", color: "#3b82f6" },
    { key: "acousticness", label: "Acoustic", color: "#10b981" },
    { key: "instrumentalness", label: "Instrumental", color: "#ec4899" },
    { key: "speechiness", label: "Speech", color: "#eab308" },
  ];

  const center = size / 2;
  const radius = (size / 2) - 40;
  const angleStep = (Math.PI * 2) / metrics.length;

  const points = useMemo(() => {
    return metrics.map((metric, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const value = features[metric.key as keyof AudioFeatures] || 0;
      const distance = value * radius;

      return {
        x: center + distance * Math.cos(angle),
        y: center + distance * Math.sin(angle),
        labelX: center + (radius + 30) * Math.cos(angle),
        labelY: center + (radius + 30) * Math.sin(angle),
        label: metric.label,
        value: value,
      };
    });
  }, [features, metrics, angleStep, radius, center]);

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Background circles */}
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <circle
          key={scale}
          cx={center}
          cy={center}
          r={radius * scale}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {points.map((point, index) => (
        <line
          key={index}
          x1={center}
          y1={center}
          x2={center + radius * Math.cos(angleStep * index - Math.PI / 2)}
          y2={center + radius * Math.sin(angleStep * index - Math.PI / 2)}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(168, 85, 247, 0.2)"
        stroke="rgba(168, 85, 247, 0.8)"
        strokeWidth="2"
      />

      {/* Data points */}
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="4"
          fill={metrics[index].color}
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1"
        />
      ))}

      {/* Labels */}
      {points.map((point, index) => (
        <g key={index}>
          <text
            x={point.labelX}
            y={point.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-zinc-300 font-medium"
          >
            {point.label}
          </text>
          <text
            x={point.labelX}
            y={point.labelY + 12}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] fill-zinc-500 font-mono"
          >
            {(point.value * 100).toFixed(0)}%
          </text>
        </g>
      ))}
    </svg>
  );
}
