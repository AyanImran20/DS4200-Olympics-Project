import pandas as pd

# Load datasets
summer = pd.read_csv("summer.csv")
dictionary = pd.read_csv("dictionary.csv")
iso = pd.read_csv("ISO_Codes.csv")

# Clean column names
dictionary = dictionary.rename(columns={"Code": "NOC", "Country": "Country_Name"})
iso = iso.rename(columns={"country": "Country_Name", "iso": "ISO_Code"})

# Merge summer + dictionary on NOC code
merged = summer.merge(
    dictionary,
    how="left",
    left_on="Country",   # NOC code in summer.csv
    right_on="NOC"       # NOC code in dictionary.csv
)

# Merge with ISO codes on country name
merged = merged.merge(
    iso,
    how="left",
    on="Country_Name"
)

# Save output
merged.to_csv("olympics_clean.csv", index=False)
print("Saved olympics_clean.csv!")
