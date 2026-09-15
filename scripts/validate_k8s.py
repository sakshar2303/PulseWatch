#!/usr/bin/env python3
"""Validates all Kubernetes manifests in deployments/k8s/."""

import glob
import sys
import yaml

manifests = sorted(glob.glob("deployments/k8s/*.yaml"))
if not manifests:
    print("Error: No Kubernetes manifests found in deployments/k8s/")
    sys.exit(1)

total_docs = 0
for path in manifests:
    with open(path, "r") as f:
        docs = list(yaml.safe_load_all(f))
        for doc in docs:
            if not doc:
                continue
            assert "apiVersion" in doc, f"{path}: missing apiVersion"
            assert "kind" in doc, f"{path}: missing kind"
            assert "metadata" in doc, f"{path}: missing metadata"
            total_docs += 1
    print(f"  ✓ {path}")

print(f"\nAll {len(manifests)} Kubernetes manifest files ({total_docs} resources) validated successfully.")
