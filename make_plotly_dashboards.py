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
    # ---------------------------------------------------
    first_women_year = df[df["Gender"] == "Women"]["Year"].min()

    # compute medals by Year x Sport x Gender, only for years
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
        barmode="stack",  # default view
        title="Medals by Sport and Gender 1900–2012 (Ranked by Medal Count)",
    )

    # Layout + interaction widget (stacked vs grouped)
    fig_bar.update_layout(
        xaxis_title="Sport",
        yaxis_title="Medal Count",
        legend_title="Gender",
        xaxis_tickangle=-45,
        margin=dict(l=60, r=20, t=80, b=110),
        updatemenus=[
            dict(
                type="buttons",
                direction="right",
                x=0.0,
                y=1.18,
                xanchor="left",
                yanchor="top",
                buttons=[
                    dict(
                        label="Stacked (Total medals)",
                        method="relayout",
                        args=[{"barmode": "stack"}],
                    ),
                    dict(
                        label="Grouped (Compare genders)",
                        method="relayout",
                        args=[{"barmode": "group"}],
                    ),
                ],
            )
        ],
    )

    fig_bar.write_html(
        os.path.join(OUT_DIR, "sport_gender_medals_bar.html"),
        include_plotlyjs="cdn"
    )

    # ---------------------------------------------------
    # Figure 3: Sport x Year heatmap (optimized)
    # ---------------------------------------------------
    team_sports = [
        "Basketball",
        "Volleyball",
        "Handball",
        "Football",
        "Football / Soccer",
        "Soccer",
        "Hockey",
        "Ice Hockey",
        "Baseball",
        "Softball",
        "Water Polo",
        "Team Competition",
        "Team",
        "Rackets",
        "Tug of War",
    ]
    heat_source = df[~df["Sport"].isin(team_sports)]

    # Aggregate medal counts by sport & year
    heat = (
        heat_source.groupby(["Year", "Sport"])
        .size()
        .reset_index(name="MedalCount")
    )

    # Pivot to Sport x Year and fill missing values with 0
    pivot_all = heat.pivot(index="Sport", columns="Year", values="MedalCount").fillna(0)

    # Order sports by total medals (dominant sports first)
    sport_totals = pivot_all.sum(axis=1).sort_values(ascending=False)
    pivot_all = pivot_all.loc[sport_totals.index]

    # Create a "Top 15 sports" view
    top_sports = sport_totals.head(15).index
    pivot_top = pivot_all.loc[top_sports]

    # Build figure with two heatmap traces (all vs top 15) + dropdown
    fig_heat = go.Figure()

    # Trace 0: all sports
    fig_heat.add_trace(
        go.Heatmap(
            z=pivot_all.values,
            x=[str(x) for x in pivot_all.columns],
            y=pivot_all.index.tolist(),
            colorscale="Blues",
            colorbar_title="Medals",
            name="All sports",
            visible=True,
        )
    )

    # Trace 1: top 15 sports
    fig_heat.add_trace(
        go.Heatmap(
            z=pivot_top.values,
            x=[str(x) for x in pivot_top.columns],
            y=pivot_top.index.tolist(),
            colorscale="Blues",
            colorbar_title="Medals",
            name="Top 15 sports",
            visible=False,
            showscale=True,
        )
    )

    # Layout + dropdown to switch views
    fig_heat.update_layout(
        title="Medal Distribution Across Sports and Years (Individual / Category-Heavy Sports)",
        xaxis_title="Olympic Year",
        yaxis_title="Sport",
        margin=dict(l=90, r=20, t=90, b=60),
        updatemenus=[
            dict(
                type="buttons",
                direction="right",
                x=0.0,
                y=1.18,
                xanchor="left",
                yanchor="top",
                buttons=[
                    dict(
                        label="All sports",
                        method="update",
                        args=[
                            {"visible": [True, False]},
                            {"yaxis": {"title": "Sport"}},
                        ],
                    ),
                    dict(
                        label="Top 15 sports",
                        method="update",
                        args=[
                            {"visible": [False, True]},
                            {"yaxis": {"title": "Sport (Top 15 by medals)"}},
                        ],
                    ),
                ],
            )
        ],
    )

    fig_heat.write_html(
        os.path.join(OUT_DIR, "sport_year_heatmap.html"),
        include_plotlyjs="cdn"
    )
    
    # ---------------------------------------------------
    # Extra interactive figure: Brushing scatter by country
    # ---------------------------------------------------
    scatter_df = medals_by_year_country.copy()

    fig_scatter = go.Figure()

    # Scatter with brushing (lasso select)
    fig_scatter.add_trace(
        go.Scatter(
            x=scatter_df["Country_Name"],
            y=scatter_df["MedalCount"],
            mode="markers",
            marker=dict(size=8, color="steelblue"),
            selected=dict(marker=dict(size=11, color="black")),
            unselected=dict(marker=dict(opacity=0.25)),
            hovertemplate="<b>%{x}</b><br>Year=%{customdata}<br>Medals=%{y}<extra></extra>",
            customdata=scatter_df["Year"],
            name="Country-Year"
        )
    )

    fig_scatter.update_layout(
        dragmode="lasso",
        clickmode="event+select",
        title="Brushing Scatter: Medal Counts by Country and Year",
        xaxis_title="Country",
        yaxis_title="Medal Count",
        margin=dict(l=60, r=20, t=70, b=150),
    )

    fig_scatter.update_xaxes(tickangle=-60)

    fig_scatter.write_html(
        os.path.join(OUT_DIR, "medals_country_scatter.html"),
        include_plotlyjs="cdn"
    )


    print("Saved HTML dashboards in:", OUT_DIR)


if __name__ == "__main__":
    main()
