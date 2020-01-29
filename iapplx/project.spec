Summary: %{_name} %{_version}
Name: %{_name}
Version: %{_version}
Release: %{_release}
BuildArch: noarch
License: Commercial
Group: Development/Tools
Packager: F5 Networks <support@f5.com>

%description
Framework for deploying configuration on BIG-IP using mustache templates

%define IAPP_INSTALL_DIR /var/config/rest/iapps/%{name}

%prep
# Metadata
echo -n %{version}-%{release} > %{_builddir}/version
# REST worker
mkdir -p %{_builddir}/nodejs
cp -r %{main}/nodejs %{_builddir}
cp %{main}/package.json %{_builddir}
%{main}/../scripts/copy-node-modules.sh %{main} %{_builddir}/node_modules
# Presentation layer
mkdir -p %{_builddir}/presentation
cp %{main}/presentation/*.html %{_builddir}/presentation
cp %{main}/presentation/bundle.js %{_builddir}/presentation
cp -r %{main}/presentation/css %{_builddir}/presentation
cp -r %{main}/presentation/js %{_builddir}/presentation
cp -r %{main}/presentation/webfonts %{_builddir}/presentation
# Data files
cp -r %{main}/../schemas %{_builddir}
cp -r %{main}/../templates %{_builddir}

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp -r %{_builddir}/* $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}

%clean rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root)
%{IAPP_INSTALL_DIR}
