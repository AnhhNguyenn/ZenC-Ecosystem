import React from "react";
import clsx from "clsx";
import styles from "./Skeleton.module.scss";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={clsx(styles.skeleton, className)} {...props} />;
}
