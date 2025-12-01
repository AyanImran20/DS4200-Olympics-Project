import os
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

# -------------------------------------------------------
# Paths
# -------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_PATH = os.path.join(BASE_DIR, "data", "olympics_clean.csv")
OUT_DIR = os.path.join(BASE_DIR, "interactive")
os.makedirs(OUT_DIR, exist_ok=True)


def main():
    # ---------------------------------------------------
    # Load data
    # ---------------------------------------------------
    df = pd.read_csv(DATA_PATH)

    # ---------------------------------------------------
    # Figure 1: Animated world choropleth
    # ---------------------------------------------------
    medals_by_year_country = (
        df.groupby(["Year", "Country_Name"])
          .size()
          .reset_index(name="MedalCount")
    )

    fig_world = px.choropleth(
        medals_by_year_country,
        locations="Country_Name",
        locationmode="country names",
        color="MedalCount",
        hover_name="Country_Name",
        animation_frame="Year",
        color_continuous_scale="Blues",
        title="Olympic Medals by Country (All Years)"
    )

    fig_world.write_html(
        os.path.join(OUT_DIR, "world_medals_choropleth.html"),
        include_plotlyjs="cdn"
    )

    # ---------------------------------------------------
    # Figure 2: Animated stacked bar (Sport x Gender)
    #     (using teammate's logic)
    # ---------------------------------------------------
    # find the first year where Women appear
    first_women_year = df[df["Gender"] == "Women"]["Year"].min()

    # compute medals by Year x Sport x Gender, only for years
    # where women are present in the data
    medals_sport_gender = (
        df[df["Year"] >= first_women_year]
        .groupby(["Year", "Sport", "Gender"])
        .size()
        .reset_index(name="MedalCount")
    )

    # sort so that, within each year, sports are ordered by medal count
    medals_sport_gender = medals_sport_gender.sort_values(
        ["Year", "MedalCount"], ascending=[True, False]
    )

    fig_bar = px.bar(
        medals_sport_gender,
        x="Sport",
        y="MedalCount",
        color="Gender",
        animation_frame="Year",
        barmode="stack",
        title="Medals by Sport and Gender 1900–2012 (Ranked by Medal Count)",
    )

    fig_bar.update_layout(
        xaxis_title="Sport",
        yaxis_title="Medal Count"
    )

    fig_bar.write_html(
        os.path.join(OUT_DIR, "sport_gender_medals_bar.html"),
        include_plotlyjs="cdn"
    )

    # ---------------------------------------------------
    # Figure 3: Sport x Year heatmap
    # ---------------------------------------------------
    heat = (
        df.groupby(["Year", "Sport"])
          .size()
          .reset_index(name="MedalCount")
    )

    pivot = heat.pivot(index="Sport", columns="Year", values="MedalCount")

    fig_heat = go.Figure(
        data=go.Heatmap(
            z=pivot.values,
            x=[str(x) for x in pivot.columns],
            y=pivot.index.tolist(),
            colorscale="Blues",
            colorbar_title="Medals",
        )
    )

    fig_heat.update_layout(
        title="Medal Distribution Across Sports and Years",
        xaxis_title="Olympic Year",
        yaxis_title="Sport"
    )

    fig_heat.write_html(
        os.path.join(OUT_DIR, "sport_year_heatmap.html"),
        include_plotlyjs="cdn"
    )

    print("Saved HTML dashboards in:", OUT_DIR)


if __name__ == "__main__":
    main()
